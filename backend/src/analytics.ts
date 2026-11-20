import { createHash, randomBytes } from "node:crypto";
import type { Db } from "mongodb";

/**
 * getPackd's own analytics: what visitors do on the site, counted in our database. No cookies and nothing stored on
 * the visitor's device. A visitor is a hash of their IP address and browser with a salt that changes every day, so
 * the same person counts once a day and can't be followed from one day to the next; the IP itself is never kept.
 * Events are deleted after about 13 months.
 */
export const EVENT_TYPES = ["page_view", "search", "book_click", "save_trip", "share_shortlist", "client_error"] as const;
export const KEEP_DAYS = 400;

// crawlers, link previews and test browsers aren't visitors
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|curl|wget|python|axios|node-fetch|go-http/i;
export const isBot = (ua: string) => !ua || BOT_UA.test(ua);

export const deviceOf = (ua: string) => (/iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop");

/** The day in India (yyyy-mm-dd), which the daily counts and the visitor salt go by. */
export const istDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);

let salt: { day: string; value: string } | null = null;
/** Today's salt, kept in the database so a restart during the day doesn't count everyone again. */
async function todaysSalt(db: Db): Promise<string> {
  const day = istDay();
  if (salt?.day === day) return salt.value;
  const meta = db.collection<{ key: string; day: string; value: string }>("meta");
  const found = await meta.findOne({ key: "analytics_salt" });
  if (found?.day === day) {
    salt = { day, value: found.value };
  } else {
    const value = randomBytes(16).toString("hex");
    await meta.updateOne({ key: "analytics_salt" }, { $set: { day, value } }, { upsert: true });
    salt = { day, value };
  }
  return salt.value;
}

export async function visitorId(db: Db, ip: string, ua: string): Promise<string> {
  return createHash("sha256").update(`${await todaysSalt(db)}|${ip}|${ua}`).digest("hex").slice(0, 16);
}

export async function ensureIndexes(db: Db) {
  const ev = db.collection("events");
  await ev.createIndex({ ts: 1 }, { expireAfterSeconds: KEEP_DAYS * 86_400 });
  await ev.createIndex({ day: 1, type: 1 });
}

type Row = Record<string, unknown>;

/** The numbers for the admin page's Analytics tab, over the last `days` days (today included). */
export async function report(db: Db, days: number) {
  const ev = db.collection("events");
  const from = istDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const inRange = { day: { $gte: from } };
  const agg = (pipeline: Row[]) => ev.aggregate(pipeline).toArray();

  const [daily, totals, byOperator, byTrip, tripViews, searches, emptySearches, pages, devices, refs, errors] = await Promise.all([
    // per day: people (distinct visitors), page views, searches and Book clicks
    agg([{ $match: inRange }, { $group: {
      _id: "$day", visitors: { $addToSet: "$visitor" },
      views: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
      searches: { $sum: { $cond: [{ $eq: ["$type", "search"] }, 1, 0] } },
      book_clicks: { $sum: { $cond: [{ $eq: ["$type", "book_click"] }, 1, 0] } },
    } }, { $project: { _id: 0, day: "$_id", visitors: { $size: "$visitors" }, views: 1, searches: 1, book_clicks: 1 } }, { $sort: { day: 1 } }]),
    agg([{ $match: inRange }, { $group: { _id: "$type", n: { $sum: 1 } } }]),
    agg([{ $match: { ...inRange, type: "book_click" } }, { $group: { _id: "$props.op", clicks: { $sum: 1 }, people: { $addToSet: { $concat: ["$day", "$visitor"] } } } },
      { $project: { _id: 0, op: "$_id", clicks: 1, people: { $size: "$people" } } }, { $sort: { clicks: -1 } }, { $limit: 25 }]),
    agg([{ $match: { ...inRange, type: "book_click" } }, { $group: { _id: { trip: "$props.trip", op: "$props.op" }, clicks: { $sum: 1 } } },
      { $project: { _id: 0, trip: "$_id.trip", op: "$_id.op", clicks: 1 } }, { $sort: { clicks: -1 } }, { $limit: 25 }]),
    agg([{ $match: { ...inRange, type: "page_view", path: /^\/trip\// } }, { $group: { _id: null, n: { $sum: 1 } } }]),
    agg([{ $match: { ...inRange, type: "search", "props.q": { $nin: [null, ""] } } },
      { $group: { _id: { $toLower: "$props.q" }, n: { $sum: 1 }, results: { $avg: "$props.results" } } },
      { $project: { _id: 0, q: "$_id", n: 1, results: { $round: ["$results", 0] } } }, { $sort: { n: -1 } }, { $limit: 20 }]),
    agg([{ $match: { ...inRange, type: "search", "props.results": 0 } },
      { $group: { _id: { $toLower: { $ifNull: ["$props.q", "(filters only)"] } }, n: { $sum: 1 } } },
      { $project: { _id: 0, q: "$_id", n: 1 } }, { $sort: { n: -1 } }, { $limit: 15 }]),
    agg([{ $match: { ...inRange, type: "page_view" } }, { $group: { _id: "$path", n: { $sum: 1 } } },
      { $project: { _id: 0, path: "$_id", n: 1 } }, { $sort: { n: -1 } }, { $limit: 15 }]),
    agg([{ $match: { ...inRange, type: "page_view" } }, { $group: { _id: "$device", people: { $addToSet: { $concat: ["$day", "$visitor"] } } } },
      { $project: { _id: 0, device: "$_id", people: { $size: "$people" } } }, { $sort: { people: -1 } }]),
    agg([{ $match: { ...inRange, type: "page_view", ref: { $nin: [null, ""] } } }, { $group: { _id: "$ref", n: { $sum: 1 } } },
      { $project: { _id: 0, ref: "$_id", n: 1 } }, { $sort: { n: -1 } }, { $limit: 15 }]),
    ev.find({ ...inRange, type: "client_error" }, { projection: { _id: 0, ts: 1, path: 1, "props.message": 1, device: 1 } }).sort({ ts: -1 }).limit(20).toArray(),
  ]);

  // operator names and trip titles for the click tables
  const opIds = [...new Set([...byOperator, ...byTrip].map((r) => r.op).filter(Boolean))] as string[];
  const tripIds = byTrip.map((r) => r.trip).filter(Boolean) as string[];
  const [ops, trips] = await Promise.all([
    db.collection("operators").find({ id: { $in: opIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    db.collection("trips").find({ id: { $in: tripIds } }, { projection: { _id: 0, id: 1, title: 1 } }).toArray(),
  ]);
  const opName = new Map(ops.map((o) => [o.id, o.name]));
  const tripTitle = new Map(trips.map((t) => [t.id, t.title]));
  const count = (t: string) => (totals.find((r) => r._id === t)?.n as number) ?? 0;

  // every day in the range, quiet days as zeros, so the charts show the whole period
  const byDay = new Map(daily.map((d) => [d.day as string, d]));
  const allDays = Array.from({ length: days }, (_, i) => istDay(new Date(Date.now() - (days - 1 - i) * 86_400_000)))
    .map((day) => byDay.get(day) ?? { day, visitors: 0, views: 0, searches: 0, book_clicks: 0 });

  return {
    from, days,
    totals: {
      visitors: daily.reduce((n, d) => n + (d.visitors as number), 0),
      views: count("page_view"), searches: count("search"), book_clicks: count("book_click"),
      saves: count("save_trip"), shares: count("share_shortlist"), errors: count("client_error"),
      trip_views: (tripViews[0]?.n as number) ?? 0,
    },
    daily: allDays,
    by_operator: byOperator.map((r) => ({ ...r, name: opName.get(r.op as string) ?? r.op })),
    by_trip: byTrip.map((r) => ({ ...r, title: tripTitle.get(r.trip as string) ?? r.trip, operator: opName.get(r.op as string) ?? r.op })),
    searches, empty_searches: emptySearches, pages, devices, referrers: refs, errors,
  };
}

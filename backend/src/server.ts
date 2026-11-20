import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import { MongoClient } from "mongodb";
import { z } from "zod";

import { PyRandom, addDays, cmpTuple, imageUrl, nowIso, parseISODate } from "./utils.js";
import * as se from "./searchEngine.js";
import { DESTINATIONS, DEST_BY_SLUG, KEYWORDS } from "./destinations.js";
import { factsFor } from "./facts.js";
import { seasonInfo } from "./seasons.js";
import { ALL_VISAS, DEST_COUNTRIES, VISAS, VISAS_CHECKED, visasFor, type VisaInfo } from "./visas.js";
import { type ImportResult, runImport } from "./importTrips.js";
import * as acct from "./accounts.js";
import * as analytics from "./analytics.js";
import { HOUR, MINUTE, limit } from "./rateLimit.js";
import { runInstagramImport } from "./importInstagram.js";
import { reviewSources, runReviewImport } from "./importReviews.js";
import { fetchedAt, instagramFetchedAt, itinerary, loadSeed, reviewsFetchedAt, seedVersion, slugify } from "./seedData.js";
import type { Departure, GroupStats, Operator, Review, Trip } from "./types.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const client = new MongoClient(env("MONGO_URL"));
const db = client.db(env("DB_NAME"));
const NOP = { projection: { _id: 0 } };

/** Raised from a route to send `{"detail": ...}` with the given status, like FastAPI's HTTPException. */
class HttpError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
  }
}

const hex = (n: number) => randomUUID().replaceAll("-", "").slice(0, n);

async function seedIfNeeded() {
  const meta = await db.collection("meta").findOne({ key: "seed" });
  const version = seedVersion();
  if (meta?.version === version) return;
  const { operators, trips, departures } = loadSeed();
  // replace earlier sample or imported records; operators and trips added by hand in the admin page are kept
  const replaced = { $or: [{ sample: true }, { source: "import" }] };
  const collections: [string, object[]][] = [["operators", operators], ["trips", trips], ["departures", departures], ["group_stats", []], ["reviews", []]];
  for (const [name, docs] of collections) {
    await db.collection(name).deleteMany(["operators", "trips", "reviews"].includes(name) ? replaced : {});
    // Two backends starting together on one database both delete, then both insert, and every record ended up
    // twice. With ids unique, the second insert is refused record by record and the first copy stands.
    if (["operators", "trips", "departures"].includes(name)) await db.collection(name).createIndex({ id: 1 }, { unique: true });
    if (!docs.length) continue;
    try {
      await db.collection(name).insertMany(docs.map((d) => ({ ...d })), { ordered: false });
    } catch (e) {
      const errs = (e as { writeErrors?: { code: number }[] }).writeErrors;
      if (!errs?.length || errs.some((w) => w.code !== 11000)) throw e;
      console.info(`Seeding ${name}: ${errs.length} already present (another backend seeded at the same time)`);
    }
  }
  await db.collection("meta").updateOne({ key: "seed" }, { $set: { version } }, { upsert: true });
  console.info(`Seeded ${operators.length} operators, ${trips.length} trips, ${departures.length} departures`);
}

async function reloadCache() {
  const load = <T>(name: string) => db.collection(name).find({}, NOP).limit(20000).toArray() as unknown as Promise<T[]>;
  se.build(await load<Operator>("operators"), await load<Trip>("trips"), await load<Departure>("departures"),
           await load<GroupStats>("group_stats"), await load<Review>("reviews"));
}

// ---------- scheduled refresh ----------
// Every few days the server re-reads the operators' sites, so new trips, dates and prices appear without anyone
// running the importer by hand. IMPORT_EVERY_DAYS sets the gap (default 3); 0 switches it off.
const REFRESH_DAYS = Number(process.env.IMPORT_EVERY_DAYS ?? 3);
const RETRY_MS = 6 * 3_600_000; // after a run that failed or wrote nothing, wait this long before trying again
const refresh: { running: boolean; nextAt: string | null; lastAttemptAt: string | null; last: ImportResult | { error: string } | null; timer: NodeJS.Timeout | null } =
  { running: false, nextAt: null, lastAttemptAt: null, last: null, timer: null };

async function refreshTrips(reason: string) {
  if (refresh.running) return;
  refresh.running = true;
  refresh.lastAttemptAt = new Date().toISOString();
  console.info(`Trip refresh started (${reason})`);
  try {
    const r = await runImport();
    refresh.last = r;
    // follower counts move slowly, so they are re-read at most once a week
    const igAge = instagramFetchedAt() ? Date.now() - Date.parse(instagramFetchedAt()) : Infinity;
    if (igAge > 7 * 86_400_000) {
      try {
        const ig = await runInstagramImport();
        console.info(`Instagram follower counts read from ${ig.source}: ${ig.read} accounts, ${ig.failed} without a figure`);
      } catch (e) {
        console.error("Instagram follower refresh failed", e);
      }
    }
    // Google and Tripadvisor ratings are re-read weekly too, once a key for either is set
    const rvAge = reviewsFetchedAt() ? Date.now() - Date.parse(reviewsFetchedAt()) : Infinity;
    let reviewsRead = false;
    if (reviewSources().length && rvAge > 7 * 86_400_000) {
      try {
        const rv = await runReviewImport();
        reviewsRead = true;
        console.info(`Reviews read from ${rv.sources.join(" and ")}: ${rv.google} operators with a Google rating, ${rv.tripadvisor} with a Tripadvisor rating`);
      } catch (e) {
        console.error("Review refresh failed", e);
      }
    }
    if (r.written || igAge > 7 * 86_400_000 || reviewsRead) {
      await seedIfNeeded();
      await reloadCache();
      console.info(`Trip refresh done: ${r.trips} trips, ${r.departures} departures from ${r.operators} operators; ${r.new_trips.length} new, ${r.removed_trips} no longer listed`);
    } else {
      console.warn(`Trip refresh kept the previous data: ${r.note}`);
    }
  } catch (e) {
    refresh.last = { error: e instanceof Error ? e.message : String(e) };
    console.error("Trip refresh failed", e);
  } finally {
    refresh.running = false;
    scheduleRefresh();
  }
}

function scheduleRefresh() {
  if (refresh.timer) clearTimeout(refresh.timer);
  refresh.nextAt = null;
  if (!(REFRESH_DAYS > 0)) return;
  // due a set number of days after the data was last read; if that has passed (the server was off), run shortly after start
  const due = Date.parse(fetchedAt()) + REFRESH_DAYS * 86_400_000;
  const retryAfter = refresh.lastAttemptAt ? Date.parse(refresh.lastAttemptAt) + RETRY_MS : 0;
  const at = Math.max(due, retryAfter, Date.now() + 60_000);
  refresh.nextAt = new Date(at).toISOString();
  refresh.timer = setTimeout(() => void refreshTrips("scheduled"), at - Date.now());
  refresh.timer.unref();
}

// ---------- request parsing ----------
/** Query string as a flat map; a repeated key keeps its last value. */
function queryParams(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.originalUrl, "http://localhost").searchParams);
}

function requiredQuery(q: Record<string, string>, name: string): string {
  if (!Object.hasOwn(q, name)) throw new HttpError(422, [{ type: "missing", loc: ["query", name], msg: "Field required" }]);
  return q[name];
}

function intQuery(q: Record<string, string>, name: string, dflt: number): number {
  if (!Object.hasOwn(q, name)) return dflt;
  if (!/^\s*[+-]?\d+\s*$/.test(q[name])) {
    throw new HttpError(422, [{ type: "int_parsing", loc: ["query", name], msg: "Input should be a valid integer", input: q[name] }]);
  }
  return Number(q[name]);
}

function parseBody<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  const r = schema.safeParse(req.body);
  if (!r.success) throw new HttpError(422, r.error.issues.map((i) => ({ type: i.code, loc: ["body", ...i.path], msg: i.message })));
  return r.data;
}

// integers are accepted as numbers or numeric strings
const int = z.union([z.number().int(), z.string().regex(/^\s*[+-]?\d+\s*$/).transform(Number)]);

const app = express();
const api = express.Router();
// behind a host's proxy, the visitor's address is in X-Forwarded-For; TRUST_PROXY is how many proxies to trust (1 for
// most hosts, 0 when the API is reached directly). Rate limits, login throttling and analytics all go by it.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

const origins = (process.env.CORS_ORIGINS ?? "*").split(",").map((o) => o.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

api.get("/", (_req, res) => {
  res.json({ message: "getPackd API", departures: se.STATE.items.length, prices_fetched_at: fetchedAt(), next_refresh_at: refresh.nextAt, refreshing: refresh.running });
});

api.get("/search", (req, res) => {
  const q = queryParams(req);
  const { offset: _offset, limit: _limit, ...params } = q;
  res.json(se.search(params, intQuery(q, "offset", 0), Math.min(intQuery(q, "limit", 30), 300)));
});

api.get("/meta", async (_req, res) => {
  const ops = await db.collection("operators").find({}, { projection: { _id: 0, id: 1, name: 1, category: 1, verified_status: 1 } }).limit(500).toArray();
  const suggestions: { label: string; sub: string; value: string; type: string }[] = [];
  // each name once (Kerala the destination, not again as Kerala the region), whichever kind comes first
  const seen = new Set<string>();
  const add = (s: { label: string; sub: string; value: string; type: string }) => {
    const k = s.label.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    suggestions.push(s);
  };
  // only suggest places that currently have departures
  const upcoming = se.upcoming();
  const live = new Set(upcoming.map((i) => i.dest_slug));
  const listed = DESTINATIONS.filter((d) => live.has(d.slug));
  for (const d of listed) {
    const sub = [...new Set([d.region, ...d.countries])].join(" · ");
    add({ label: d.name, sub, value: d.name, type: "destination" });
    for (const pl of d.places) add({ label: pl, sub: d.name, value: pl, type: "city" });
  }
  // the towns and treks trips are named after (Kasol, Gokarna, Kedarkantha...), when a trip there is coming up
  const allText = upcoming.map((i) => i.text).join("\n");
  for (const d of listed) {
    for (const w of KEYWORDS[d.slug] ?? []) {
      if (w.length < 4 || !new RegExp(`(^|[^a-z])${w.replace(/ /g, "[\\s-]+")}($|[^a-z])`).test(allText)) continue;
      add({ label: w.replace(/\b\w/g, (c) => c.toUpperCase()), sub: d.name, value: w.replace(/\b\w/g, (c) => c.toUpperCase()), type: "city" });
    }
  }
  for (const d of listed) {
    for (const c of [...d.countries, d.region]) add({ label: c, sub: "Country / region", value: c, type: "country" });
  }
  res.json({
    destinations: DESTINATIONS.map(({ slug, name, region, countries, dtype, image, lat, lng, climate, meeting, flight_est }) =>
      ({ slug, name, region, countries, dtype, image, lat, lng, climate, meeting, flight_est })),
    operators: ops, suggestions, price_bounds: { min: se.STATE.pmin, max: se.STATE.pmax }, prices_fetched_at: fetchedAt(),
    // the dates the search calendar offers: today to the last departure we hold
    date_bounds: { first: se.today(), last: upcoming.reduce((m, i) => (i.start > m ? i.start : m), se.today()) },
  });
});

api.get("/home", async (_req, res) => {
  const items = se.upcoming().filter((i) => i.status !== "cancelled");
  const by = new Map<string, { slug: string; destination: string; image: string | null; curated: boolean; dtype: string; country: string; lat: number; lng: number; climate: string[]; min_price: number; count: number }>();
  for (const i of items) {
    let b = by.get(i.dest_slug);
    if (!b) {
      // destination tiles use our own photo where we have one, otherwise the first trip's photo
      const own = DEST_BY_SLUG.get(i.dest_slug)?.image ?? null;
      b = { slug: i.dest_slug, destination: i.destination, image: own ?? i.image, curated: own !== null, dtype: i.dtype, country: i.countries[0], lat: i.lat, lng: i.lng, climate: DEST_BY_SLUG.get(i.dest_slug)?.climate ?? [], min_price: 10 ** 9, count: 0 };
      by.set(i.dest_slug, b);
    }
    b.min_price = Math.min(b.min_price, i.true_price);
    b.count += 1;
  }
  const trendingKey = (i: se.Item) => [Number(i.status !== "filling"), -(i.rating ?? 0), i.start];
  const trending = [...items].sort((a, b) => cmpTuple(trendingKey(a), trendingKey(b))).slice(0, 8);
  res.json({
    destinations: [...by.values()].sort((a, b) => a.min_price - b.min_price), trending: trending.map((i) => se.card(i)),
    styles: Object.fromEntries(se.STYLES.map((s) => [s, items.filter((i) => i.categories.includes(s)).length])),
    stats: { departures: items.length, operators: new Set(items.map((i) => i.op.id)).size, destinations: by.size, operators_listed: await db.collection("operators").countDocuments({}) },
  });
});

api.get("/trips/:trip_id", async (req, res) => {
  const tripId = req.params.trip_id;
  const trip = await db.collection("trips").findOne({ id: tripId }, NOP);
  if (!trip) throw new HttpError(404, "Trip not found");
  const op = await db.collection("operators").findOne({ id: trip.operator_id }, NOP);
  const reviews = await db.collection("reviews").find({ trip_id: tripId }, NOP).limit(50).toArray();
  const deps = se.itemsForTrip(tripId).map((i) => se.card(i));
  const similar = new Map<string, se.Card>();
  for (const i of se.upcoming()) {
    if (i.dest_slug === trip.destination_slug && i.trip_id !== tripId && i.status !== "cancelled") {
      const cur = similar.get(i.trip_id);
      if (!cur || i.true_price < cur.true_price) similar.set(i.trip_id, se.card(i));
    }
  }
  // the photo as a browser can load it (some operators give relative or doubled paths), as search shows it
  res.json({ trip: { ...trip, image: imageUrl(trip.image, trip.url) || DEST_BY_SLUG.get(trip.destination_slug)?.image || null }, operator: op, departures: deps, reviews, destination: DEST_BY_SLUG.get(trip.destination_slug) ?? null, season: seasonInfo(trip.destination_slug),
             visas: visasFor(trip.destination_slug), visas_checked: VISAS_CHECKED, facts: factsFor(trip.destination_slug),
             similar: [...similar.values()].slice(0, 4) });
});

// Entry rules for Indian passport holders, per country, with the destinations (and live departures) each one covers.
api.get("/visas", (_req, res) => {
  const live = new Map<string, number>();
  for (const i of se.upcoming()) if (i.status !== "cancelled") live.set(i.dest_slug, (live.get(i.dest_slug) ?? 0) + 1);
  const withTrips = (v: VisaInfo) => ({
    ...v,
    // a Schengen country's card also lists trips to the multi-country "Europe" destination, and the Schengen card itself
    // lists trips to any of its members
    destinations: Object.entries(DEST_COUNTRIES)
      .filter(([, keys]) => keys.includes(v.key) || (v.group && keys.includes(v.key.split("-")[0])) || (v.members && keys.some((k) => k.startsWith(`${v.key}-`))))
      .map(([slug]) => ({ slug, name: DEST_BY_SLUG.get(slug)?.name ?? slug, departures: live.get(slug) ?? 0 })),
  });
  // `groups` are the one-visa-many-countries cards (Schengen) that a trip covering several members links to
  res.json({ checked: VISAS_CHECKED, countries: ALL_VISAS.map(withTrips), groups: VISAS.filter((v) => v.members).map(withTrips) });
});

// Every listed operator, with how many upcoming departures we hold for each (zero when their trips aren't imported).
api.get("/operators", async (_req, res) => {
  const ops = await db.collection("operators").find({}, { projection: { _id: 0, leaders: 0, verification: 0, external_reviews: 0 } }).limit(1000).toArray();
  const stats = new Map<string, { departures: number; trips: Set<string>; from_price: number }>();
  for (const i of se.upcoming()) {
    if (i.status === "cancelled") continue;
    let s = stats.get(i.op.id);
    if (!s) stats.set(i.op.id, (s = { departures: 0, trips: new Set(), from_price: i.true_price }));
    s.departures += 1;
    s.trips.add(i.trip_id);
    s.from_price = Math.min(s.from_price, i.true_price);
  }
  const items = ops.map((o) => {
    const s = stats.get(o.id);
    return { ...o, departures: s?.departures ?? 0, trips: s?.trips.size ?? 0, from_price: s?.from_price ?? null };
  });
  // operators with live departures first, then alphabetical
  items.sort((a, b) => b.departures - a.departures || String((a as { name?: string }).name).localeCompare(String((b as { name?: string }).name)));
  res.json({ items, total: items.length, with_departures: items.filter((o) => o.departures > 0).length });
});

api.get("/operators/:op_id", async (req, res) => {
  const opId = req.params.op_id;
  const op = await db.collection("operators").findOne({ id: opId }, NOP);
  if (!op) throw new HttpError(404, "Operator not found");
  const trips = await db.collection("trips").find({ operator_id: opId }, { projection: { _id: 0, id: 1 } }).limit(500).toArray();
  const tids: string[] = trips.map((t) => t.id);
  const deps = se.upcoming().filter((i) => tids.includes(i.trip_id)).map((i) => se.card(i)).sort((a, b) => cmpTuple([a.start], [b.start]));
  const reviews = await db.collection("reviews").find({ trip_id: { $in: tids } }, NOP).limit(12).toArray();
  res.json({ operator: op, departures: deps, reviews, trip_count: tids.length });
});

api.get("/compare", async (req, res) => {
  const out = [];
  for (const did of requiredQuery(queryParams(req), "deps").split(",").filter(Boolean).slice(0, 4)) {
    const i = se.itemByDep(did);
    if (!i) continue;
    const trip = await db.collection("trips").findOne({ id: i.trip_id }, NOP);
    out.push({ card: se.card(i), trip });
  }
  res.json({ items: out });
});

const cardsFor = (depIds: string[]) => depIds.map((d) => se.itemByDep(d)).filter((i) => i !== undefined).map((i) => se.card(i));

api.get("/departures", (req, res) => {
  res.json({ items: cardsFor(requiredQuery(queryParams(req), "ids").split(",").filter(Boolean)) });
});

// what people type into the site's forms: trimmed, and with a sensible length, so blanks and junk are turned away
const textField = (min: number, max: number, what: string) =>
  z.string().trim().min(min, min > 1 ? `${what} needs at least ${min} characters` : `Add ${what}`).max(max, `${what} is too long (max ${max} characters)`);
const phoneField = z.string().trim().refine((p) => /^\+?[\d\s()-]{7,20}$/.test(p) && (p.match(/\d/g)?.length ?? 0) >= 7, "That phone number doesn't look right");
const emailField = z.string().trim().max(200).refine((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), "That email doesn't look right");
const optionalEmail = z.union([z.literal(""), emailField]).nullable().default(null);

const LeadIn = z.object({
  dep_id: z.string().max(200),
  trip_id: z.string().max(200),
  name: textField(2, 80, "Your name"),
  phone: phoneField,
  email: optionalEmail,
  party_size: int.pipe(z.number().min(1, "At least 1 traveller").max(50)).default(1),
  message: z.string().trim().max(2000, "Message is too long (max 2000 characters)").nullable().default(""),
  kind: z.string().max(40).default("enquire"),
});

api.post("/leads", limit("leads", 20, HOUR), async (req, res) => {
  const lead = parseBody(LeadIn, req);
  const i = se.itemByDep(lead.dep_id);
  // an enquiry is about a real departure of the trip it names
  if (!i || i.trip_id !== lead.trip_id) throw new HttpError(404, "That departure doesn't exist");
  const doc: Record<string, unknown> = { ...lead, id: randomUUID(), created_at: nowIso() };
  Object.assign(doc, { trip_title: i.title, operator_id: i.op.id, operator_name: i.op.name, start: i.start });
  await db.collection("leads").insertOne({ ...doc });
  res.json({ ok: true, id: doc.id });
});

const AlertIn = z.object({
  email: z.string(),
  filters: z.record(z.string(), z.string()).default({}),
  label: z.string().default(""),
  kinds: z.array(z.string()).default(["new_departures", "price_drops"]),
});

// Saved searches belong to an account: an email typed into a box proves nothing, so listing or deleting someone's
// alerts by their address alone isn't possible. The account's email is the one alerts go to.
api.post("/alerts", limit("alerts", 60, HOUR), async (req, res) => {
  const u = await currentUser(req);
  const a = parseBody(AlertIn, req);
  const doc = { ...a, email: u.email, user_id: u.id, id: randomUUID(), created_at: nowIso(), matches_now: se.count(a.filters) };
  await db.collection("saved_searches").insertOne({ ...doc });
  res.json(doc);
});

api.get("/alerts", async (req, res) => {
  const u = await currentUser(req);
  const docs = await db.collection("saved_searches").find({ user_id: u.id }, NOP).sort({ created_at: -1 }).limit(100).toArray();
  for (const d of docs) d.matches_now = se.count(d.filters ?? {});
  res.json({ items: docs });
});

api.delete("/alerts/:aid", async (req, res) => {
  const u = await currentUser(req);
  const r = await db.collection("saved_searches").deleteOne({ id: req.params.aid, user_id: u.id });
  if (!r.deletedCount) throw new HttpError(404, "Alert not found");
  res.json({ ok: true });
});

// ---------- analytics ----------
// The browser sends these with navigator.sendBeacon, as plain text (that needs no CORS preflight, and it still goes
// out when the visitor is leaving for the operator's site). Bots are ignored; nothing that identifies anyone is kept.
const EventIn = z.object({
  type: z.enum(analytics.EVENT_TYPES),
  path: z.string().max(300).default(""),
  ref: z.string().max(120).default(""),
  props: z.record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).default({}),
});

api.post("/events", limit("events", 1200, HOUR), express.text({ type: "*/*", limit: "8kb" }), async (req, res) => {
  const ua = req.get("user-agent") ?? "";
  if (analytics.isBot(ua)) { res.status(204).end(); return; }
  let body: unknown = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { throw new HttpError(422, "Invalid event"); }
  }
  const r = EventIn.safeParse(body);
  if (!r.success) throw new HttpError(422, "Invalid event");
  const e = r.data;
  if (Object.keys(e.props).length > 12) throw new HttpError(422, "Invalid event");
  await db.collection("events").insertOne({
    type: e.type, path: e.path.split("?")[0], ref: e.ref.replace(/^www\./, ""), props: e.props,
    ts: new Date(), day: analytics.istDay(), visitor: await analytics.visitorId(db, req.ip ?? "", ua), device: analytics.deviceOf(ua),
  });
  res.status(204).end();
});

const ShortlistIn = z.object({
  dep_ids: z.array(z.string()),
  name: z.string().default("Our trip shortlist"),
});

api.post("/shortlists", limit("shortlists", 60, HOUR), async (req, res) => {
  const s = parseBody(ShortlistIn, req);
  const sid = hex(10);
  await db.collection("shortlists").insertOne({ id: sid, name: s.name, dep_ids: s.dep_ids.slice(0, 20), votes: {}, created_at: nowIso() });
  res.json({ id: sid });
});

async function getShortlist(sid: string) {
  const s = await db.collection("shortlists").findOne({ id: sid }, NOP);
  if (!s) throw new HttpError(404, "Shortlist not found");
  return { shortlist: s, items: cardsFor(s.dep_ids) };
}

api.get("/shortlists/:sid", async (req, res) => {
  res.json(await getShortlist(req.params.sid));
});

const VoteIn = z.object({
  dep_id: z.string().max(200),
  voter: z.string().max(200),
  vote: z.string(),
});

/**
 * The name a vote is stored under, as the voter typed it (राहुल, "Priya S." and "Priya S" stay three people). Only
 * what a database field name can't hold is swapped: "." for a look-alike dot, and a leading "$".
 * The frontend (pages/Shortlist.jsx) works out the same key to show someone their own vote.
 */
const voterKey = (name: string) =>
  name.normalize("NFC").trim().replace(/\s+/g, " ").slice(0, 30).replaceAll(".", "．").replace(/^\$/, "＄") || "anon";

api.post("/shortlists/:sid/vote", limit("votes", 300, HOUR), async (req, res) => {
  const v = parseBody(VoteIn, req);
  if (!["up", "down", "none"].includes(v.vote)) throw new HttpError(400, "Invalid vote");
  if (!v.voter.trim()) throw new HttpError(422, "Add your name to vote");
  const key = `votes.${v.dep_id.replaceAll(".", "_")}.${voterKey(v.voter)}`;
  const upd = v.vote === "none" ? { $unset: { [key]: "" } } : { $set: { [key]: v.vote } };
  const sid = String(req.params.sid);
  const r = await db.collection("shortlists").updateOne({ id: sid }, upd);
  if (!r.matchedCount) throw new HttpError(404, "Shortlist not found");
  res.json(await getShortlist(sid));
});

const SignupIn = z.object({
  company: textField(2, 120, "Company name"),
  contact_name: textField(2, 80, "Your name"),
  email: emailField,
  phone: phoneField,
  website: z.string().trim().max(300, "Website is too long (max 300 characters)").nullable().default(""),
  category: z.string().max(40).default("community"),
  departures_per_year: int.pipe(z.number().min(0, "Departures a year can't be negative").max(10000)).nullable().default(null),
  message: z.string().trim().max(2000, "Message is too long (max 2000 characters)").nullable().default(""),
});

api.post("/operator-signups", limit("operator-signups", 20, HOUR), async (req, res) => {
  const s = parseBody(SignupIn, req);
  await db.collection("operator_signups").insertOne({ ...s, id: randomUUID(), created_at: nowIso() });
  res.json({ ok: true });
});

const NL_SYSTEM = `You convert a traveller's free-text request into JSON search filters for an Indian group-trip marketplace.
Today is ${new Date().toISOString().slice(0, 10)}. Departures run from today to about eight months ahead. Prices are INR.
Return ONLY a JSON object using any of these keys (omit unknown):
q: destination text (e.g. "Bali", "Spiti", "Japan"), only if a place is named.
start, end: ISO dates. A month name means the whole of its next occurrence (first to last day).
flex: "0" | "2" | "month" | "any".
max_price, min_price: integers in INR ("30k" -> 30000, "1L" -> 100000).
as: comma list from solo_woman,solo,friends,couple,senior
gender: comma list from women_only,mixed
dur: comma list from 2-5,6-9,10-14,15+ ("5-day" -> 2-5, "week" -> 6-9)
style: comma list from hiking,offbeat,luxury,backpacking,culture_food,beaches,wildlife,spiritual,roadtrip,photography,party,workation,winter
pace: slow|moderate|adventurous ("chill"/"relaxed" -> slow). difficulty: easy|moderate|hard
dtype: domestic|international. climate: comma list from snow,beach,mountains,desert,jungle,city
stay: hostel,budget,comfort,luxury. diet: veg,nonveg,vegan,jain. trust: verified,women_leader,medical,solo_friendly
visa_easy: "1". seats: integer. age: comma list from 18-25,25-35,35-45,45-60,60+
Also add "summary": a short human-readable sentence of what you understood.`;
const NL_KEYS = new Set(["q", "start", "end", "flex", "max_price", "min_price", "as", "gender", "dur", "style", "pace", "difficulty", "dtype",
                         "climate", "stay", "diet", "trust", "visa_easy", "seats", "age"]);

const NLIn = z.object({ text: z.string() });

api.post("/nl-search", limit("nl-search", 60, HOUR), async (req, res) => {
  const body = parseBody(NLIn, req);
  let data: Record<string, unknown>;
  try {
    // credentials come from ANTHROPIC_API_KEY
    const message = await new Anthropic().messages.create({
      model: process.env.NL_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: NL_SYSTEM,
      messages: [{ role: "user", content: body.text.slice(0, 400) }],
    });
    const raw = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = /\{.*\}/s.exec(raw);
    data = m ? JSON.parse(m[0]) : {};
  } catch (e) {
    // the details (an API key problem, a request id) go to the server log only, never to the browser; the search
    // engine's own reading of the sentence stands in, so the search still works without the AI
    console.error("NL parse failed", e);
    const read = se.interpret(body.text.slice(0, 400));
    if (!read) throw new HttpError(502, "Couldn't read that right now. Try the search filters instead.");
    res.json({ params: read.params, summary: read.summary });
    return;
  }
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!NL_KEYS.has(k) || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    params[k] = Array.isArray(v) ? v.map(String).join(",") : String(v);
  }
  if (params.start && !("flex" in params)) params.flex = "0";
  res.json({ params, summary: data.summary ?? "" });
});

// ---------- traveller accounts (optional) ----------
// An account only keeps your shortlist (hearts) on the server, so it follows you to other devices. Nothing on the site
// needs one. The browser sends the session token as "Authorization: Bearer <token>".
type UserDoc = { id: string; name: string; email: string; pass: string; hearts: string[]; created_at: string };
const userOut = (u: UserDoc) => ({ id: u.id, name: u.name, email: u.email, hearts: u.hearts ?? [] });

async function startSession(userId: string) {
  const token = acct.newToken();
  await db.collection("sessions").insertOne({
    token: acct.tokenHash(token), user_id: userId, created_at: nowIso(),
    expires_at: new Date(Date.now() + acct.SESSION_DAYS * 86_400_000),
  });
  return token;
}

const bearer = (req: Request) => /^Bearer\s+(\S+)$/i.exec(req.get("authorization") ?? "")?.[1];

async function currentUser(req: Request): Promise<UserDoc> {
  const token = bearer(req);
  const s = token && await db.collection("sessions").findOne({ token: acct.tokenHash(token) });
  if (!s || s.expires_at < new Date()) throw new HttpError(401, "Not logged in");
  const u = await db.collection<UserDoc>("users").findOne({ id: s.user_id }, NOP);
  if (!u) throw new HttpError(401, "Not logged in");
  return u;
}

const HEARTS = z.array(z.string().max(120)).max(200);
const SignupUserIn = z.object({ name: z.string().trim().min(1, "Tell us your name").max(60), email: z.string(), password: z.string(), hearts: HEARTS.default([]) });
const LoginUserIn = z.object({ email: z.string(), password: z.string(), hearts: HEARTS.default([]) });

api.post("/auth/signup", limit("signup", 20, HOUR), async (req, res) => {
  const b = parseBody(SignupUserIn, req);
  const email = acct.cleanEmail(b.email);
  if (!acct.looksLikeEmail(email)) throw new HttpError(422, "That email doesn't look right");
  if (b.password.length < 8) throw new HttpError(422, "Use at least 8 characters for the password");
  if (b.password.length > 200) throw new HttpError(422, "That password is too long");
  if (await db.collection("users").findOne({ email })) throw new HttpError(409, "There's already an account with this email. Log in instead?");
  const user: UserDoc = { id: randomUUID(), name: b.name, email, pass: await acct.hashPassword(b.password), hearts: [...new Set(b.hearts)], created_at: nowIso() };
  try {
    await db.collection("users").insertOne({ ...user });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new HttpError(409, "There's already an account with this email. Log in instead?");
    throw e;
  }
  res.json({ token: await startSession(user.id), user: userOut(user) });
});

// logging in adds the hearts saved on this device to the account's, so nothing picked before logging in is lost
api.post("/auth/login", limit("login", 60, 15 * MINUTE), async (req, res) => {
  const b = parseBody(LoginUserIn, req);
  const email = acct.cleanEmail(b.email);
  const key = `${req.ip}|${email}`;
  if (acct.tooManyTries(key)) throw new HttpError(429, "Too many tries. Wait 15 minutes and try again.");
  const u = await db.collection<UserDoc>("users").findOne({ email }, NOP);
  const ok = u ? await acct.checkPassword(b.password, u.pass) : await acct.checkNobody(b.password);
  if (!u || !ok) { acct.noteFail(key); throw new HttpError(401, "That email and password don't match"); }
  acct.clearFails(key);
  const hearts = [...new Set([...(u.hearts ?? []), ...b.hearts])].slice(0, 200);
  if (hearts.length !== (u.hearts ?? []).length) await db.collection("users").updateOne({ id: u.id }, { $set: { hearts } });
  res.json({ token: await startSession(u.id), user: userOut({ ...u, hearts }) });
});

api.get("/auth/me", async (req, res) => {
  res.json({ user: userOut(await currentUser(req)) });
});

api.post("/auth/logout", async (req, res) => {
  const token = bearer(req);
  if (token) await db.collection("sessions").deleteOne({ token: acct.tokenHash(token) });
  res.json({ ok: true });
});

api.put("/me/hearts", async (req, res) => {
  const u = await currentUser(req);
  const { hearts } = parseBody(z.object({ hearts: HEARTS }), req);
  await db.collection("users").updateOne({ id: u.id }, { $set: { hearts: [...new Set(hearts)] } });
  res.json({ ok: true });
});

// ---------- admin ----------
// The admin page only works with a strong ADMIN_PASSWORD (12+ characters, not the old published default); without
// one it stays switched off. Each login gets its own random key, kept in memory, that expires after 12 hours.
const ADMIN_SESSION_MS = 12 * 60 * 60_000;
const adminSessions = new Map<string, number>(); // key hash -> expiry

function adminPasswordOk(): boolean {
  const p = process.env.ADMIN_PASSWORD ?? "";
  return p.length >= 12 && p !== "wayfind2026";
}

const sameText = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
};

function adminToken(): string {
  const token = randomBytes(32).toString("hex");
  adminSessions.set(createHash("sha256").update(token).digest("hex"), Date.now() + ADMIN_SESSION_MS);
  return token;
}

function requireAdmin(req: Request) {
  const token = req.get("x-admin-token") ?? "";
  const key = createHash("sha256").update(token).digest("hex");
  const until = adminSessions.get(key);
  if (!token || !until || until < Date.now()) {
    if (until) adminSessions.delete(key);
    throw new HttpError(401, "Unauthorized");
  }
}

const LoginIn = z.object({ username: z.string(), password: z.string() });

// guessing the admin password is slowed down: 10 wrong tries from one address, then a 15-minute wait
api.post("/admin/login", limit("admin-login", 30, 15 * MINUTE), (req, res) => {
  const b = parseBody(LoginIn, req);
  const key = `admin|${req.ip}`;
  if (acct.tooManyTries(key)) throw new HttpError(429, "Too many tries. Wait 15 minutes and try again.");
  if (!adminPasswordOk()) throw new HttpError(503, "The admin page is switched off until a strong ADMIN_PASSWORD (12+ characters) is set on the server.");
  if (!sameText(b.username, env("ADMIN_USERNAME")) || !sameText(b.password, env("ADMIN_PASSWORD"))) { acct.noteFail(key); throw new HttpError(401, "Invalid credentials"); }
  acct.clearFails(key);
  res.json({ token: adminToken() });
});

// what visitors did on the site, for the admin page's Analytics tab (see analytics.ts)
api.get("/admin/analytics", async (req, res) => {
  requireAdmin(req);
  const days = Math.min(Math.max(intQuery(queryParams(req), "days", 30), 1), 400);
  res.json(await analytics.report(db, days));
});

api.get("/admin/overview", async (req, res) => {
  requireAdmin(req);
  const ops = await db.collection("operators").find({}, { projection: { _id: 0, leaders: 0 } }).limit(500).toArray();
  const leads = await db.collection("leads").find({}, NOP).sort({ created_at: -1 }).limit(500).toArray();
  const signups = await db.collection("operator_signups").find({}, NOP).sort({ created_at: -1 }).limit(200).toArray();
  const alerts = await db.collection("saved_searches").countDocuments({});
  const trips = await db.collection("trips").find({}, { projection: { _id: 0, id: 1, title: 1, operator_id: 1 } }).limit(2000).toArray();
  res.json({ operators: ops, leads, signups, alerts, trips,
             counts: { departures: se.STATE.items.length, trips: trips.length, operators: ops.length },
             refresh: { every_days: REFRESH_DAYS, prices_fetched_at: fetchedAt(), instagram_fetched_at: instagramFetchedAt() || null, reviews_fetched_at: reviewsFetchedAt() || null, review_sources: reviewSources(), next_at: refresh.nextAt, running: refresh.running, last: refresh.last } });
});

// Start a refresh now instead of waiting for the schedule. It runs in the background and takes several minutes.
api.post("/admin/refresh", (req, res) => {
  requireAdmin(req);
  if (refresh.running) throw new HttpError(409, "A refresh is already running");
  void refreshTrips("started from the admin page");
  res.status(202).json({ ok: true, started: true });
});

const OperatorIn = z.object({
  name: z.string(),
  category: z.string(),
  website: z.string().default(""),
  instagram: z.string().default(""),
  years_active: int.default(1),
  leader_name: z.string().default(""),
  leader_gender: z.string().default("female"),
});

api.post("/admin/operators", async (req, res) => {
  requireAdmin(req);
  const o = parseBody(OperatorIn, req);
  const oid = slugify(o.name);
  if (await db.collection("operators").findOne({ id: oid })) throw new HttpError(409, "Operator exists");
  const doc: Operator = {
    id: oid, name: o.name, category: o.category, website: o.website, instagram: o.instagram,
    verified_status: "pending", verification: { registration: false, gst: false, leaders_checked: false, refund_history: false },
    years_active: o.years_active, rating: 4.5, review_count: 0, bio: "Newly listed operator.",
    leaders: [{ name: o.leader_name || "Trip Leader", gender: o.leader_gender, years: 1, trips_led: 0, certs: [], bio: "" }],
    sample: false,
  };
  await db.collection("operators").insertOne({ ...doc });
  await reloadCache();
  res.json(doc);
});

const VerifyIn = z.object({
  status: z.string(),
  verification: z.record(z.string(), z.boolean()).nullable().default(null),
});

api.patch("/admin/operators/:op_id", async (req, res) => {
  requireAdmin(req);
  const v = parseBody(VerifyIn, req);
  if (!["verified", "pending", "unverified"].includes(v.status)) throw new HttpError(400, "Bad status");
  const upd: Record<string, unknown> = { verified_status: v.status };
  if (v.verification && Object.keys(v.verification).length) upd.verification = v.verification;
  else if (v.status === "verified") upd.verification = { registration: true, gst: true, leaders_checked: true, refund_history: true };
  await db.collection("operators").updateOne({ id: req.params.op_id }, { $set: upd });
  await reloadCache();
  res.json({ ok: true });
});

const TripIn = z.object({
  operator_id: z.string(),
  title: z.string(),
  destination_slug: z.string(),
  duration_days: int.default(6),
  categories: z.array(z.string()).default([]),
  audience_tags: z.array(z.string()).default(["solo", "friends"]),
  gender_policy: z.string().default("mixed"),
  age_band: z.string().default("25-35"),
  stay_tier: z.string().default("budget"),
  pace: z.string().default("moderate"),
  difficulty: z.string().default("easy"),
  max_group: int.default(16),
  meals: z.boolean().default(true),
  start_date: z.string(),
  price_inr: int,
  seats_total: int.default(16),
});

api.post("/admin/trips", async (req, res) => {
  requireAdmin(req);
  const t = parseBody(TripIn, req);
  const dest = DEST_BY_SLUG.get(t.destination_slug);
  if (!dest || !(await db.collection("operators").findOne({ id: t.operator_id }))) throw new HttpError(400, "Unknown destination or operator");
  const tid = `${dest.slug}-${slugify(t.title).slice(0, 28)}-${hex(6)}`;
  const intl = dest.dtype === "international";
  const inc = { local_transport: true, stays: true, meals: t.meals, permits_visa: !intl, guide: true,
                activities: "partial" as const, insurance: false, taxes: true, flights_included: false };
  const trip: Trip = {
    id: tid, operator_id: t.operator_id, title: t.title, destination_slug: dest.slug,
    destinations: dest.places, country: dest.countries, domestic_or_international: dest.dtype,
    climate_tags: dest.climate, meeting_point: dest.meeting, end_point: dest.end,
    duration_days: t.duration_days, categories: t.categories, audience_tags: t.audience_tags, pace: t.pace,
    difficulty: t.difficulty, stay_tier: t.stay_tier, room_sharing: "Twin sharing", private_room: t.stay_tier === "luxury",
    min_group: Math.max(4, Math.floor(t.max_group / 3)), max_group: t.max_group, age_band: t.age_band, gender_policy: t.gender_policy,
    kid_friendly: t.audience_tags.includes("family"), senior_friendly: t.pace === "slow", medical_support: false,
    visa_required: intl && !dest.visa_easy, visa_easy: dest.visa_easy, diet_options: ["veg", "nonveg"],
    itinerary_days: itinerary(new PyRandom(), dest, t.duration_days, t.stay_tier, t.meals), inclusions: inc,
    exclusions: ["Travel to the meeting point", "Some activities & entry tickets"],
    cancellation_policy: "As per operator policy.", leader: null, women_leader: false, image: dest.image,
    review_count: 0, sample: false,
  };
  await db.collection("trips").insertOne({ ...trip });
  await addDep(tid, t.start_date, t.duration_days, t.price_inr, t.seats_total);
  await reloadCache();
  res.json({ ok: true, trip_id: tid });
});

const DepIn = z.object({
  trip_id: z.string(),
  start_date: z.string(),
  price_inr: int,
  seats_total: int.default(16),
});

async function addDep(tid: string, start: string, days: number, price: number, seats: number): Promise<string> {
  const s = parseISODate(start);
  if (!s) throw new Error(`Invalid isoformat string: '${start}'`);
  const did = `${tid}-${s}-${hex(4)}`;
  await db.collection("departures").insertOne({
    id: did, trip_id: tid, start_date: s, end_date: addDays(s, days - 1), price_inr: price,
    seats_total: seats, seats_left: seats, status: "open", last_verified_at: nowIso(),
  });
  return did;
}

api.post("/admin/departures", async (req, res) => {
  requireAdmin(req);
  const d = parseBody(DepIn, req);
  const trip = await db.collection("trips").findOne({ id: d.trip_id }, NOP);
  if (!trip) throw new HttpError(404, "Trip not found");
  const did = await addDep(d.trip_id, d.start_date, trip.duration_days, d.price_inr, d.seats_total);
  await reloadCache();
  res.json({ ok: true, dep_id: did });
});

app.use("/api", api);
app.use((_req, res) => {
  res.status(404).json({ detail: "Not Found" });
});
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ detail: err.detail });
  } else if ((err as { type?: string }).type?.startsWith("entity.")) {
    // body-parser failure (malformed or oversized JSON)
    res.status(422).json({ detail: [{ type: "json_invalid", loc: ["body"], msg: "JSON decode error" }] });
  } else {
    console.error(err);
    res.status(500).type("text/plain").send("Internal Server Error");
  }
});

async function main() {
  await seedIfNeeded();
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ token: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  await analytics.ensureIndexes(db);
  if (!adminPasswordOk()) console.warn("ADMIN_PASSWORD is missing, too short or the old default: the admin page is switched off.");
  await reloadCache();
  scheduleRefresh();
  console.info(refresh.nextAt ? `Next trip refresh: ${refresh.nextAt} (every ${REFRESH_DAYS} days)` : "Scheduled trip refresh is off");
  const port = Number(process.env.PORT || 8001);
  const server = app.listen(port, process.env.HOST || "0.0.0.0", () => console.info(`getPackd API listening on :${port}`));
  const shutdown = () => {
    server.close(() => void client.close().finally(() => process.exit(0)));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

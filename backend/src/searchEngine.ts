import { addDays, cmpTuple, imageUrl, lookup, monthEnd, monthStart, parseISODate, pyInt, pyRound, pySum, weekday } from "./utils.js";
import { DEST_BY_SLUG, DESTINATIONS, matchDestination } from "./destinations.js";
import { factsFor } from "./facts.js";
import { seasonInfo, seasonOf } from "./seasons.js";
import type { Departure, ExternalRating, GroupStats, Inclusions, Operator, Review, Trip } from "./types.js";

const CHECKLIST: [string, string][] = [
  ["local_transport", "Local transport"], ["stays", "Stays"], ["meals", "Meals"],
  ["permits_visa", "Permits / visa"], ["guide", "Guide / trip leader"],
  ["activities", "Activities & entries"], ["insurance", "Travel insurance"], ["taxes", "Taxes (GST 5%)"],
];
const REF: Record<string, Record<string, number>> = {
  domestic: { local_transport: 1300, meals: 900, guide: 700, activities: 1100, permits_visa: 1500, insurance: 700 },
  international: { local_transport: 2600, meals: 2200, guide: 1500, activities: 2600, permits_visa: 7000, insurance: 2800 },
};
const PER_DAY = new Set(["local_transport", "meals", "guide", "activities"]);
const STAY_NIGHT: Record<string, number> = { hostel: 900, budget: 1800, comfort: 4000, luxury: 9500 };

const AUDIENCE = ["solo", "friends", "couples", "parents", "family", "seniors_solo", "seniors_group", "corporate"];
const PERSONAS = ["solo_woman", "solo", "friends", "couple", "senior"];
const GENDERS = ["women_only", "mixed"];
const AGE_BANDS = ["18-25", "25-35", "35-45", "45-60", "60+"];
const CLIMATES = ["snow", "beach", "mountains", "desert", "jungle", "city"];
const DURS = ["2-5", "6-9", "10-14", "15+"];
export const STYLES = ["hiking", "offbeat", "luxury", "backpacking", "culture_food", "beaches", "wildlife", "spiritual",
                       "roadtrip", "photography", "party", "workation", "winter"];
const OP_CATS = ["community", "trekking", "scuba", "women_specialist", "hostel", "aggregator", "legacy", "seniors", "luxury"];
const PERSONA_LABEL: Record<string, string> = {
  solo_woman: "Great for solo women", solo: "Great for solo travellers", friends: "Great for friend groups",
  couple: "Couple-friendly", senior: "Comfortable for seniors",
};
const GROUP_LABEL: Record<string, string> = {
  audience: "audience", as: "travelling-as", gender: "group makeup", age: "age band", size: "group size",
  solo_many: "many solo travellers", dtype: "domestic/international", country: "country", climate: "climate",
  dur: "duration", style: "trip style", pace: "pace", difficulty: "difficulty", stay: "stay type",
  private_room: "private room", diet: "food", incl: "inclusions", trust: "safety & trust",
  visa_easy: "visa-easy", op_type: "operator type", operator: "operator",
};
const QUIZ_KEYS = ["fq_age", "fq_pace", "fq_budget", "fq_style", "fq_size", "fq_stay"];
const BIG = 10 ** 9;
/** Prices are re-read every 3 days; older than this, the site says so next to the price. */
export const STALE_DAYS = 7;
// an operator that names a trip for seniors ("Seniors' Special", "Senior Citizens", "60+") is saying who it suits
const SENIOR_TITLE = /\bseniors?\b|\bsenior citizens?\b|\b60\s*\+|\belderly\b/i;

export interface BreakdownLine {
  key: string;
  label: string;
  status: string;
  amount: number;
}

export interface Item {
  dep_id: string;
  trip_id: string;
  title: string;
  dest_slug: string;
  destination: string;
  region: string;
  countries: string[];
  dtype: string;
  climate: string[];
  lat: number;
  lng: number;
  image: string | null;
  url: string | null;
  source: string | null;
  start: string;
  end: string;
  duration: number;
  meeting_point: string;
  /** the city the group sets off from, when the operator says (see Trip.starts_from) */
  starts_from: string | null;
  starts_from_how: "included" | "title" | null;
  price: number;
  true_price: number;
  breakdown: BreakdownLine[];
  flights_est: number;
  seats_total: number | null;
  seats_left: number | null;
  status: string;
  min_group: number | null;
  max_group: number | null;
  age_band: string | null;
  // who else is going: null when the operator does not publish it
  age_median: number | null;
  age_range: [number, number] | null;
  gender_split: { female: number; male: number } | null;
  gender_policy: string;
  solo_ratio: number | null;
  booked: number | null;
  categories: string[];
  audience: string[];
  pace: string | null;
  difficulty: string | null;
  stay_tier: string | null;
  /** The start month against the destination's season: "Best season", or the off-season reason. */
  season: { kind: "best" | "off"; label: string } | null;
  private_room: boolean;
  kid_friendly: boolean;
  senior_friendly: boolean;
  medical_support: boolean;
  women_leader: boolean;
  visa_easy: boolean;
  diet: string[];
  inclusions: Inclusions;
  rating: number | null;
  review_count: number;
  last_verified_days: number;
  op: { id: string; name: string; category: string; verified_status: string; initials: string; instagram: string | null; instagram_followers: number | null; instagram_followers_at: string | null; instagram_followers_source: string | null; ratings: ExternalRating[] };
  text: string;
}

const CARD_KEYS = ["dep_id", "trip_id", "title", "destination", "dest_slug", "countries", "dtype", "image", "url", "source", "duration",
                   "meeting_point", "starts_from", "starts_from_how", "price", "true_price", "breakdown", "flights_est", "seats_total", "seats_left",
                   "status", "min_group", "max_group", "age_band", "age_median", "age_range", "gender_split",
                   "gender_policy", "solo_ratio", "booked", "categories", "rating", "review_count",
                   "last_verified_days", "op", "women_leader", "stay_tier", "pace", "difficulty", "season"] as const;

export type Card = Pick<Item, (typeof CARD_KEYS)[number]> & {
  start: string;
  end: string;
  fit: number | null;
  fit_label: string | null;
  best: number | null;
  sponsored: boolean;
};

export type Params = Record<string, string>;

interface Normalized {
  sel: Record<string, string[]>;
  q: string;
  /** whether a departure matches `q`; null when there is no `q` */
  qm: ((i: Item) => boolean) | null;
  /** one destination by slug, exact (the free-text `q` also matches trips that only mention a place) */
  dest: string;
  start: string | null;
  end: string | null;
  flex: string;
  min_price: number | null;
  max_price: number | null;
  seats: number | null;
  age_min: number | null;
  age_max: number | null;
  use_true: boolean;
  sort: string;
  quiz: Record<string, string>;
}

export const STATE: { items: Item[]; pmin: number; pmax: number } = { items: [], pmin: 0, pmax: 1 };

/** Today's date (yyyy-mm-dd) in India, where the trips start. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

let upcomingCache: { day: string; from: Item[]; items: Item[] } | null = null;

/**
 * The departures that haven't left yet: everything that lists or counts departures goes through this, not STATE.items.
 * Trip data is only read every so often, so the cut-off is today's date at the time of the request.
 */
export function upcoming(): Item[] {
  const day = today();
  if (upcomingCache?.day !== day || upcomingCache.from !== STATE.items) {
    upcomingCache = { day, from: STATE.items, items: STATE.items.filter((i) => i.start >= day) };
  }
  return upcomingCache.items;
}

/**
 * Imported trips: only what the operator states. Each checklist item is "included", "not_included" or "unknown",
 * and the only amount ever added is 5% GST when the operator says GST is extra.
 */
function statedPrice(trip: Trip, listed: number): [number, BreakdownLine[]] {
  let extra = 0;
  const lines = CHECKLIST.map(([key, label]) => {
    const v = lookup<boolean | "partial" | null>(trip.inclusions, key, null);
    let amount = 0;
    if (key === "taxes" && v === false) amount = Math.round(listed * 0.05);
    extra += amount;
    return { key, label, status: v === null ? "unknown" : v ? "included" : amount ? "estimated" : "not_included", amount };
  });
  return [listed + extra, lines];
}

export function truePrice(trip: Trip, listed: number): [number, BreakdownLine[]] {
  if (trip.source === "import") return statedPrice(trip, listed);
  const intl = trip.domestic_or_international === "international";
  const days = trip.duration_days;
  const inc = trip.inclusions;
  const lines: BreakdownLine[] = [];
  let extra = 0;
  for (const [key, label] of CHECKLIST) {
    const v = lookup(inc, key, false);
    let amt: number;
    if (key === "taxes") {
      amt = v ? 0 : listed * 0.05;
    } else {
      let base: number;
      if (key === "stays") {
        if (!trip.stay_tier || !Object.hasOwn(STAY_NIGHT, trip.stay_tier)) throw new Error(`Unknown stay tier: ${trip.stay_tier}`);
        base = STAY_NIGHT[trip.stay_tier] * (days - 1) * (intl ? 1.8 : 1);
      } else {
        const r = REF[intl ? "international" : "domestic"][key];
        base = PER_DAY.has(key) ? r * days : r;
      }
      amt = v === true ? 0 : base * (v === "partial" ? 0.5 : 1);
    }
    amt = pyRound(amt, -2);
    const status = amt === 0 ? "included" : v === "partial" ? "partial" : "estimated";
    lines.push({ key, label, status, amount: amt });
    extra += amt;
  }
  return [listed + extra, lines];
}

function size(i: Item): string | null {
  if (i.max_group === null) return null;
  return i.max_group < 10 ? "small" : i.max_group <= 20 ? "medium" : "large";
}

function dur(i: Item): string {
  const d = i.duration;
  return d <= 5 ? "2-5" : d <= 9 ? "6-9" : d <= 14 ? "10-14" : "15+";
}

function personaMatch(i: Item, p: string): boolean {
  const a = i.audience;
  const g = i.gender_policy;
  switch (p) {
    // a woman travelling alone, from an old link or the plain-words search: women-only groups, as the search's switch gives
    case "solo_woman": return g === "women_only";
    // anyone travelling alone: solo-friendly trips with a mixed group
    case "solo": return a.includes("solo") && ["mixed", "mostly_women", "mostly_men"].includes(g);
    case "friends": return a.includes("friends");
    case "couple": return a.includes("couples") && !["women_only", "men_only"].includes(g);
    // seniors travelling alone or together, and trips suited to taking parents along
    case "senior": return a.includes("seniors_solo") || a.includes("seniors_group") || a.includes("parents") || i.senior_friendly;
    default: return false;
  }
}

function incl(i: Item, v: string): boolean {
  if (v === "flights") return Boolean(lookup(i.inclusions, "flights_included", false));
  return lookup(i.inclusions, v, false) === true;
}

function trust(i: Item, v: string): boolean {
  switch (v) {
    case "verified": return i.op.verified_status === "verified";
    case "women_leader": return i.women_leader;
    case "medical": return i.medical_support;
    case "solo_friendly": return i.audience.includes("solo") && (i.solo_ratio ?? 0) >= 0.35;
    default: return false;
  }
}

type Pred = (i: Item, v: string) => boolean;
// mode, options (null = derived from the data), predicate
const FACETS: Record<string, ["or" | "and" | "bool", string[] | null, Pred]> = {
  as: ["or", PERSONAS, personaMatch],
  audience: ["or", AUDIENCE, (i, v) => i.audience.includes(v)],
  gender: ["or", GENDERS, (i, v) => i.gender_policy === v],
  age: ["or", AGE_BANDS, (i, v) => i.age_band === v],
  size: ["or", ["small", "medium", "large"], (i, v) => size(i) === v],
  solo_many: ["bool", ["1"], (i) => (i.solo_ratio ?? 0) >= 0.5],
  dtype: ["or", ["domestic", "international"], (i, v) => i.dtype === v],
  country: ["or", null, (i, v) => i.countries.includes(v)],
  climate: ["or", CLIMATES, (i, v) => i.climate.includes(v)],
  dur: ["or", DURS, (i, v) => dur(i) === v],
  style: ["or", STYLES, (i, v) => i.categories.includes(v)],
  pace: ["or", ["slow", "moderate", "adventurous"], (i, v) => i.pace === v],
  difficulty: ["or", ["easy", "moderate", "hard"], (i, v) => i.difficulty === v],
  stay: ["or", ["hostel", "budget", "comfort", "luxury"], (i, v) => i.stay_tier === v],
  private_room: ["bool", ["1"], (i) => Boolean(i.private_room)],
  diet: ["and", ["veg", "nonveg", "vegan", "jain"], (i, v) => i.diet.includes(v)],
  incl: ["and", ["meals", "permits_visa", "flights", "insurance"], incl],
  trust: ["and", ["verified", "women_leader", "medical", "solo_friendly"], trust],
  visa_easy: ["bool", ["1"], (i) => Boolean(i.visa_easy)],
  op_type: ["or", OP_CATS, (i, v) => i.op.category === v],
  operator: ["or", null, (i, v) => i.op.id === v],
};

export function build(operators: Operator[], trips: Trip[], departures: Departure[], stats: GroupStats[], reviews: Review[]): void {
  const now = Date.now();
  const opm = new Map(operators.map((o) => [o.id, o]));
  const tm = new Map(trips.map((t) => [t.id, t]));
  const sm = new Map(stats.map((s) => [s.departure_id, s]));
  const rv = new Map<string, number[]>();
  for (const r of reviews) {
    if (!rv.has(r.trip_id)) rv.set(r.trip_id, []);
    rv.get(r.trip_id)!.push(r.rating);
  }
  const items: Item[] = [];
  for (const d of departures) {
    const t = tm.get(d.trip_id);
    const o = t && opm.get(t.operator_id);
    if (!t || !o) continue;
    // group make-up is only shown when it exists; nothing is assumed for departures without it
    const s = sm.get(d.id) ?? {
      booked_count: d.seats_total !== null && d.seats_left !== null ? d.seats_total - d.seats_left : null,
      age_median: null, age_range: null, gender_split: null, solo_ratio: null,
    };
    const [tp, lines] = truePrice(t, d.price_inr);
    const dest = DEST_BY_SLUG.get(t.destination_slug);
    const start = parseISODate(d.start_date);
    const end = parseISODate(d.end_date);
    const lv = new Date(d.last_verified_at).getTime();
    if (!start || !end || Number.isNaN(lv)) throw new Error(`Departure ${d.id} has an invalid date`);
    // how long this departure really runs, from its dates; an operator's "3 days" often leaves out the overnight bus,
    // and the days off someone needs are what the dates say
    const spanDays = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
    const ratings = rv.get(t.id) ?? (o.rating !== null ? [o.rating] : []);
    const intl = t.domestic_or_international === "international";
    items.push({
      dep_id: d.id, trip_id: t.id, title: t.title, dest_slug: t.destination_slug,
      destination: dest?.name ?? (t.destinations.length ? t.destinations[0] : ""),
      region: dest?.region ?? "", countries: t.country, dtype: t.domestic_or_international,
      climate: t.climate_tags, lat: dest?.lat ?? 0, lng: dest?.lng ?? 0,
      // trips imported before imageUrl existed are repaired here too, without a fresh import
      image: imageUrl(t.image, t.url) || dest?.image || null, url: t.url ?? null, source: t.source ?? null, start, end, duration: spanDays > 0 ? spanDays : t.duration_days, meeting_point: t.meeting_point,
      starts_from: t.starts_from ?? null, starts_from_how: t.starts_from_how ?? null,
      price: d.price_inr, true_price: tp, breakdown: lines,
      flights_est: !intl || t.source === "import" || lookup(t.inclusions, "flights_included", false) ? 0 : (dest?.flight_est ?? 0),
      // "Filling fast" is only said of seats read recently; an operator's site we couldn't read for a week isn't news
      seats_total: d.seats_total, seats_left: d.seats_left, status: d.status === "filling" && now - lv > STALE_DAYS * 86_400_000 ? "open" : d.status,
      min_group: t.min_group, max_group: t.max_group, age_band: t.age_band,
      age_median: s.age_median, age_range: s.age_range, gender_split: s.gender_split,
      gender_policy: t.gender_policy, solo_ratio: s.solo_ratio, booked: s.booked_count,
      categories: t.categories, audience: t.audience_tags, pace: t.pace, difficulty: t.difficulty,
      stay_tier: t.stay_tier, season: seasonOf(t.destination_slug, start), private_room: t.private_room ?? false, kid_friendly: t.kid_friendly,
      senior_friendly: t.senior_friendly || SENIOR_TITLE.test(t.title), medical_support: t.medical_support,
      women_leader: t.women_leader ?? false, visa_easy: t.visa_easy ?? !t.visa_required,
      diet: t.diet_options, inclusions: t.inclusions,
      rating: ratings.length ? pyRound(pySum(ratings) / ratings.length, 1) : null, review_count: t.review_count ?? ratings.length,
      last_verified_days: Math.max(0, Math.floor((now - lv) / 86_400_000)),
      op: {
        id: o.id, name: o.name, category: o.category, verified_status: o.verified_status,
        instagram: o.instagram || null, instagram_followers: o.instagram_followers ?? null,
        instagram_followers_at: o.instagram_followers_at ?? null, instagram_followers_source: o.instagram_followers_source ?? null,
        ratings: o.external_ratings ?? [],
        // "Treks and Trails" is TT, "The Flapper Life" FL: the small words are skipped (the trip page works it out the same way)
        initials: o.name.replaceAll("&", " ").split(/\s+/).filter((w) => w && !/^(and|the|of)$/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase(),
      },
      // where it starts is searchable too: "Rishikesh" finds the treks that begin there
      text: [t.title, dest?.name ?? "", dest?.region ?? "", t.country.join(" "), t.destinations.join(" "), t.meeting_point ?? ""].join(" ").toLowerCase(),
    });
  }
  STATE.items = items;
  const prices = items.length ? items.map((i) => i.true_price) : [0, 1];
  STATE.pmin = Math.min(...prices);
  STATE.pmax = Math.max(...prices);
}

function listParam(params: Params, k: string): string[] {
  return (lookup(params, k, "") || "").split(",").filter(Boolean);
}

function intParam(params: Params, k: string): number | null {
  const v = lookup<string | null>(params, k, null);
  if (v === null || v === "") return null;
  if (!/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v)) return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : null;
}

// words that name no place and no preference, left out when matching a search to trips
const STOP_WORDS = new Set(["trip", "trips", "tour", "tours", "group", "groups", "to", "in", "for", "the", "a", "an", "of", "and",
  "with", "on", "at", "my", "me", "i", "we", "our", "want", "looking", "some", "any", "package", "packages", "travel",
  "holiday", "holidays", "vacation", "plan", "near", "around", "&"]);

const qTokens = (q: string) => q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t && !STOP_WORDS.has(t));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// a word that starts with what was typed: "gokarn" finds Gokarna, "goa" doesn't find "goal"
const wordStart = (t: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(t)}`, "u");

/**
 * The destinations a search names outright, by their name, region or country. "Bali" is the island in Indonesia, not
 * every trip with Bali in its title (Bali Pass is a trek in Uttarakhand); "Himachal" also takes in Spiti.
 */
function namedPlaces(q: string): Set<string> {
  const out = new Set<string>();
  for (const d of DESTINATIONS) {
    const name = d.name.toLowerCase(), region = d.region.toLowerCase();
    if (name === q || region === q || region.startsWith(`${q} `) || d.countries.some((c) => c.toLowerCase() === q)) out.add(d.slug);
  }
  return out;
}

function qMatcher(q: string): ((i: Item) => boolean) | null {
  if (!q) return null;
  const named = namedPlaces(q);
  if (named.size) return (i) => named.has(i.dest_slug) || i.countries.some((c) => c.toLowerCase() === q);
  // otherwise every word has to appear: "kasol kheerganga" is the trips that go to both
  const res = qTokens(q).map(wordStart);
  if (!res.length) return null;
  return (i) => res.every((re) => re.test(i.text));
}

function normalize(params: Params): Normalized {
  const get = (k: string) => lookup(params, k, "");
  let q = get("q").trim().toLowerCase();
  if (["anywhere", "everywhere", "anywhere – everywhere"].includes(q)) q = "";
  const start = parseISODate(get("start"));
  const quiz: Record<string, string> = {};
  for (const k of QUIZ_KEYS) if (get(k)) quiz[k] = get(k);
  return {
    sel: Object.fromEntries(Object.keys(FACETS).map((k) => [k, listParam(params, k)])),
    q,
    qm: qMatcher(q),
    dest: get("dest"),
    start,
    end: parseISODate(get("end")) ?? start,
    flex: get("flex") || "0",
    min_price: intParam(params, "min_price"),
    max_price: intParam(params, "max_price"),
    seats: intParam(params, "seats"),
    age_min: intParam(params, "age_min"),
    age_max: intParam(params, "age_max"),
    use_true: lookup(params, "true_price", "1") !== "0",
    sort: get("sort") || "best",
    quiz,
  };
}

function flexDays(flex: string): number {
  return /^\d+$/.test(flex) ? Number(flex) : 0;
}

/**
 * The dates a departure has to fall in. A range someone picked (24–28 Dec) means the trip has to fit inside it, back
 * by the last day, as that's their leave; a single day, or a whole month, means leaving on it or in it.
 */
type DateWindow = { from: string; to: string; fit: boolean };

function dateWindow(p: Normalized): DateWindow | null {
  if (!p.start || p.flex === "any") return null;
  if (p.flex === "month") {
    const s = monthStart(p.start);
    let e = monthEnd(s);
    if (p.end && p.end > e) e = p.end;
    return { from: s, to: e, fit: false };
  }
  const f = flexDays(p.flex);
  const end = p.end ?? p.start;
  return { from: addDays(p.start, -f), to: addDays(end, f), fit: end > p.start };
}

function base(i: Item, p: Normalized): boolean {
  if (p.qm && !p.qm(i)) return false;
  if (p.dest && i.dest_slug !== p.dest) return false;
  const pr = p.use_true ? i.true_price : i.price;
  if (p.min_price !== null && pr < p.min_price) return false;
  if (p.max_price !== null && pr > p.max_price) return false;
  if (p.seats && ((i.seats_left !== null && i.seats_left < p.seats) || i.status === "cancelled")) return false;
  if (p.age_min !== null && (i.age_median === null || i.age_median < p.age_min)) return false;
  if (p.age_max !== null && (i.age_median === null || i.age_median > p.age_max)) return false;
  return true;
}

function inWindow(i: Item, w: DateWindow | null): boolean {
  if (w === null) return true;
  if (i.start < w.from || i.start > w.to) return false;
  return !w.fit || i.end <= w.to;
}

function passes(i: Item, key: string, vals: string[]): boolean {
  const [mode, , pred] = FACETS[key];
  return mode === "and" ? vals.every((v) => pred(i, v)) : vals.some((v) => pred(i, v));
}

function activeFacets(p: Normalized): [string, string[]][] {
  return Object.entries(p.sel).filter(([, v]) => v.length);
}

function filter(p: Normalized): Item[] {
  const w = dateWindow(p);
  const active = activeFacets(p);
  return upcoming().filter((i) => base(i, p) && inWindow(i, w) && active.every(([k, v]) => passes(i, k, v)));
}

export function fitScore(i: Item, personas: string[], quiz: Record<string, string>): [number | null, string | null] {
  const hasQuiz = Object.keys(quiz).length > 0;
  if (!personas.length && !hasQuiz) return [null, null];
  let best = 0;
  let who: string | null = null;
  for (const pz of personas.length ? personas : [null]) {
    let s = pz === null ? 55 : personaMatch(i, pz) ? 50 : 15;
    const g = i.gender_policy;
    const sr = i.solo_ratio ?? 0;
    if (pz === "solo_woman") {
      s += lookup({ women_only: 30, mostly_women: 22, mixed: 8 }, g, 0) + sr * 12 + (i.women_leader ? 6 : 0);
    } else if (pz === "solo") {
      s += lookup({ mixed: 18, mostly_women: 12, mostly_men: 12 }, g, 0) + sr * 14;
    } else if (pz === "couple") {
      s += (i.private_room ? 22 : 0) + (g === "mixed" ? 10 : 0) + (i.pace !== "adventurous" ? 8 : 0);
    } else if (pz === "friends") {
      s += (size(i) !== "small" ? 15 : 6) + (i.age_band !== null && ["18-25", "25-35"].includes(i.age_band) ? 12 : 4)
        + (i.categories.includes("party") || i.categories.includes("backpacking") ? 8 : 0);
    } else if (pz === "senior") {
      s += (i.senior_friendly ? 18 : 0) + (i.medical_support ? 12 : 0) + (i.pace === "slow" ? 10 : 0) + (i.difficulty === "easy" ? 6 : 0);
    }
    if (hasQuiz) {
      if (quiz.fq_age && i.age_range) {
        const a = pyInt(quiz.fq_age);
        s += i.age_range[0] - 3 <= a && a <= i.age_range[1] + 3 ? 10 : -10;
      }
      if (quiz.fq_pace) s += quiz.fq_pace === i.pace ? 8 : -4;
      if (quiz.fq_style) s += quiz.fq_style.split(",").some((c) => i.categories.includes(c)) ? 9 : -3;
      if (quiz.fq_budget) s += i.true_price <= pyInt(quiz.fq_budget) ? 8 : -14;
      if (quiz.fq_size) s += quiz.fq_size === size(i) ? 6 : -3;
      if (quiz.fq_stay) s += quiz.fq_stay === i.stay_tier ? 6 : -2;
    }
    s = Math.max(0, Math.min(100, Math.trunc(s)));
    if (s > best) {
      best = s;
      who = pz;
    }
  }
  let label: string | null = null;
  if (who) {
    label = best >= 62 ? lookup(PERSONA_LABEL, who, "Okay fit") : "Okay fit";
    if (i.age_range) label += ` · ages ${i.age_range[0]}–${i.age_range[1]}`;
  }
  return [best, label];
}

function bestScore(i: Item, fit: number | null): number {
  const trustF = lookup({ verified: 1, pending: 0.82, listed: 0.82, unverified: 0.65 }, i.op.verified_status, 0.65);
  const fresh = Math.max(0.6, 1 - i.last_verified_days / 45);
  const review = i.rating === null ? 0.8 : Math.max(0.5, Math.min(1, 0.6 + (0.4 * (i.rating - 3.5)) / 1.5));
  const span = STATE.pmax - STATE.pmin + 1;
  const priceF = 1 - (0.35 * (i.true_price - STATE.pmin)) / span;
  let s = ((fit ?? 72) / 100) * trustF * fresh * review * priceF;
  if (i.status === "cancelled") s *= 0.05;
  return s;
}

export function card(i: Item, fit: number | null = null, fitLabel: string | null = null, best: number | null = null): Card {
  const picked = Object.fromEntries(CARD_KEYS.map((k) => [k, i[k]])) as Pick<Item, (typeof CARD_KEYS)[number]>;
  return { ...picked, start: i.start, end: i.end, fit, fit_label: fitLabel, best: best !== null ? pyRound(best * 100) : null, sponsored: false };
}

type Scored = [item: Item, fit: number | null, best: number, label: string | null];

function sortKey(sort: string, useTrue: boolean): (x: Scored) => (number | string)[] {
  return ([i, , best]) => {
    const c = i.status === "cancelled" ? 1 : 0;
    const pr = useTrue ? i.true_price : i.price;
    switch (sort) {
      case "cheapest": return [c, pr];
      case "priciest": return [c, -pr];
      case "soonest": return [c, i.start, pr];
      case "shortest": return [c, i.duration, pr];
      case "rated": return [c, -(i.rating ?? 0), -i.review_count];
      case "verified": return [c, lookup({ verified: 0, pending: 1, unverified: 2 }, i.op.verified_status, 3), i.last_verified_days];
      default: return [c, -best];
    }
  };
}

// ---------- when a search finds nothing: a misspelt place, or a sentence ----------

let vocab: { from: Item[]; words: string[] } | null = null;
/** Every word (4+ letters) the upcoming departures can be found by. */
function vocabulary(): string[] {
  const items = upcoming();
  if (vocab?.from !== items) {
    const s = new Set<string>();
    for (const i of items) for (const w of i.text.split(/[^\p{L}]+/u)) if (w.length >= 4) s.add(w);
    vocab = { from: items, words: [...s] };
  }
  return vocab.words;
}

function editDistance(a: string, b: string, cap: number): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      low = Math.min(low, cur[j]);
    }
    if (low > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** "kedarkanta" → "kedarkantha": each word no trip has, swapped for the closest one that does (1–2 letters off). */
function correctSpelling(q: string): string | null {
  const words = vocabulary();
  let changed = false;
  const fixed = qTokens(q).map((t) => {
    if (t.length < 5 || words.some((w) => w.startsWith(t))) return t;
    const cap = t.length >= 8 ? 2 : 1;
    let best: string | null = null;
    let bd = cap + 1;
    for (const w of words) {
      if (Math.abs(w.length - t.length) > cap) continue;
      const dist = editDistance(t, w, bd - 1);
      if (dist < bd) { bd = dist; best = w; }
    }
    if (!best) return t;
    changed = true;
    return best;
  });
  return changed ? fixed.join(" ") : null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const STYLE_WORDS: [RegExp, string, string][] = [
  [/\bbeach(es)?\b|\bislands?\b/, "beaches", "beach"],
  [/\btreks?\b|\btrekking\b|\bhik(e|es|ing)\b/, "hiking", "trek"],
  [/\bsnow\b|\bski(ing)?\b/, "winter", "snow"],
  [/\bbackpack(ing|er|ers)?\b/, "backpacking", "backpacking"],
  [/\bwildlife\b|\bsafaris?\b/, "wildlife", "wildlife"],
  [/\bspiritual\b|\byoga\b|\bpilgrimage\b/, "spiritual", "spiritual"],
  [/\broad ?trips?\b|\bbik(e|es|ing)\b/, "roadtrip", "road trip"],
  [/\bparty\b|\bfestivals?\b/, "party", "party"],
  [/\boffbeat\b|\bunexplored\b/, "offbeat", "offbeat"],
];
// long weekends whose dates move each year, as [name, first day, last day]; fixed-date ones are worked out below
const MOVING_HOLIDAYS: [RegExp, string, string, string][] = [
  [/\bholi\b/, "Holi", "2027-03-19", "2027-03-22"],
  [/\bgood friday\b|\beaster\b/, "Good Friday", "2027-03-26", "2027-03-28"],
];

/** The next time a day of the year comes round (month 0-based), as yyyy-mm-dd, given today. */
function nextOn(month: number, day: number, from: string): string {
  const y = Number(from.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisYear = `${y}-${pad(month + 1)}-${pad(day)}`;
  return thisYear >= from ? thisYear : `${y + 1}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * A search typed as a sentence ("beach trip for New Year", "5 days abroad under 60k in December"), read into the
 * filters it names. Only what is clearly there is used; null when nothing is.
 */
export function interpret(text: string): { params: Params; summary: string } | null {
  let s = ` ${text.toLowerCase().replace(/[₹,]/g, " ").replace(/\s+/g, " ")} `;
  const params: Params = {};
  const said: string[] = [];
  const now = today();
  const take = (re: RegExp) => { s = s.replace(re, " "); };

  // the city someone leaves from isn't a filter the trips support; drop it so it isn't read as the destination
  take(/\bfrom (mumbai|delhi|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|ahmedabad|gurgaon|gurugram|noida)\b/g);

  const price = /\b(?:under|below|less than|within|upto|up to|max|budget(?: of)?|<)\s*(?:rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|l|lakh|lakhs|lac|thousand)?\b/.exec(s);
  if (price) {
    const unit = price[2] ?? "";
    const n = Number(price[1]) * (unit === "k" || unit === "thousand" ? 1000 : unit.startsWith("l") ? 100000 : 1);
    if (n >= 1000) { params.max_price = String(Math.round(n)); said.push(`under ₹${Math.round(n).toLocaleString("en-IN")}`); }
    take(new RegExp(escapeRe(price[0])));
  }

  const days = /\b(\d{1,2})\s*-?\s*(days?|d|nights?|n)\b/.exec(s);
  if (days) {
    const n = Number(days[1]) + (days[2].startsWith("n") ? 1 : 0);
    params.dur = n <= 5 ? "2-5" : n <= 9 ? "6-9" : n <= 14 ? "10-14" : "15+";
    said.push(`${n} days`);
    take(new RegExp(escapeRe(days[0])));
  } else if (/\bweekend\b/.test(s)) {
    params.dur = "2-5"; said.push("a weekend"); take(/\b(long )?weekend\b/g);
  } else if (/\ba week\b|\bone week\b/.test(s)) {
    params.dur = "6-9"; said.push("a week"); take(/\b(a|one) week\b/g);
  }

  if (/\b(international|abroad|overseas|foreign)\b/.test(s)) { params.dtype = "international"; said.push("abroad"); take(/\b(international|abroad|overseas|foreign)\b/g); }
  else if (/\b(domestic|within india|in india)\b/.test(s)) { params.dtype = "domestic"; said.push("in India"); take(/\b(domestic|within india|in india)\b/g); }

  if (/\b(women|woman|girls|ladies|female)\b/.test(s)) { params.gender = "women_only"; said.push("women-only"); take(/\b(women|woman|girls|ladies|female)(-| )?(only)?\b/g); }

  const styles: string[] = [];
  for (const [re, style, word] of STYLE_WORDS) if (re.test(s)) { styles.push(style); said.unshift(`${word} trips`); s = s.replace(new RegExp(re.source, "g"), " "); }
  if (styles.length) params.style = styles.join(",");

  // when: a holiday, or a month
  let when: [string, string, string, string] | null = null; // start, end, flex, label
  if (/\bnew ?year'?s?( eve)?\b|\bnye\b/.test(s)) {
    const st = nextOn(11, 28, now);
    when = [st, addDays(st, 6), "2", "around New Year"]; take(/\bnew ?year'?s?( eve)?\b|\bnye\b/g);
  } else if (/\b(christmas|xmas)\b/.test(s)) {
    const st = nextOn(11, 22, now);
    when = [st, addDays(st, 6), "2", "around Christmas"]; take(/\b(christmas|xmas)\b/g);
  } else if (/\brepublic day\b/.test(s)) {
    const st = nextOn(0, 23, now);
    when = [st, addDays(st, 3), "2", "the Republic Day weekend"]; take(/\brepublic day\b/g);
  } else {
    const hol = MOVING_HOLIDAYS.find(([re, , , last]) => re.test(s) && last >= now);
    if (hol) { when = [hol[2], hol[3], "2", `the ${hol[1]} weekend`]; take(hol[0]); }
    else {
      const m = MONTHS.findIndex((name) => new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`).test(s));
      if (m >= 0) {
        const st = nextOn(m, 1, monthStart(now));
        when = [st, monthEnd(st), "month", `in ${MONTHS[m][0].toUpperCase()}${MONTHS[m].slice(1)}`];
        take(new RegExp(`\\b(${MONTHS[m]}|${MONTHS[m].slice(0, 3)})\\b`, "g"));
      }
    }
  }
  if (when) { [params.start, params.end, params.flex] = when; said.push(when[3]); }

  // whatever place is left
  const dest = matchDestination(s);
  if (dest) { params.q = dest.name; said.splice(styles.length, 0, `to ${dest.name}`); }

  if (!Object.keys(params).length) return null;
  const summary = said.join(" · ");
  return { params, summary: summary[0].toUpperCase() + summary.slice(1) };
}

/**
 * A search, with two second tries when it finds nothing: the place spelt the way the trips spell it ("Showing
 * kedarkantha"), then a typed sentence read as filters. Each says what it changed, so the page can show it.
 */
export function search(params: Params, offset = 0, limit = 30) {
  const out = runSearch(params, offset, limit);
  const q = normalize(params).q;
  if (out.total_departures > 0 || !q) return out;
  // only when the words themselves find nothing: if "Kasol" has trips but none on your dates or budget, that's for
  // the usual "widen the dates" suggestions, not a reason to swap Kasol for something else
  if (count({ q: params.q }) > 0) return out;
  const fixed = correctSpelling(q);
  if (fixed && fixed !== q) {
    const again = runSearch({ ...params, q: fixed }, offset, limit);
    if (again.total_departures > 0) return { ...again, corrected_q: fixed };
  }
  const read = interpret(q);
  if (read) {
    const np: Params = { ...params, ...read.params };
    if (!read.params.q) delete np.q;
    const again = runSearch(np, offset, limit);
    if (again.total_departures > 0) return { ...again, interpreted: read };
  }
  return out;
}

function runSearch(params: Params, offset = 0, limit = 30) {
  const p = normalize(params);
  const w = dateWindow(p);
  const active = activeFacets(p);
  const rows: [item: Item, fails: string[], inDates: boolean][] = [];
  for (const i of upcoming()) {
    if (!base(i, p)) continue;
    rows.push([i, active.filter(([k, v]) => !passes(i, k, v)).map(([k]) => k), inWindow(i, w)]);
  }
  const results = rows.filter(([, f, d]) => !f.length && d).map(([i]) => i);

  const facets: Record<string, Record<string, number | { count: number; label: string }>> = {};
  for (const [key, [mode, opts, pred]] of Object.entries(FACETS)) {
    const subset = rows.filter(([, f, d]) => d && (!f.length || (f.length === 1 && f[0] === key))).map(([i]) => i);
    if (opts === null) {
      const vals = new Map<string, number>();
      const names = new Map<string, string>();
      for (const i of subset) {
        if (key === "country") {
          for (const c of i.countries) vals.set(c, (vals.get(c) ?? 0) + 1);
        } else {
          vals.set(i.op.id, (vals.get(i.op.id) ?? 0) + 1);
          names.set(i.op.id, i.op.name);
        }
      }
      facets[key] = Object.fromEntries([...vals].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { count: v, label: names.get(k) ?? k }]));
      continue;
    }
    const sel = p.sel[key];
    const out: Record<string, number> = {};
    for (const o of opts) {
      if (mode === "and") {
        const need = [...new Set([...sel, o])];
        out[o] = subset.filter((i) => need.every((v) => pred(i, v))).length;
      } else {
        out[o] = subset.filter((i) => pred(i, o)).length;
      }
    }
    facets[key] = out;
  }

  const personas = p.sel.as;
  const scored: Scored[] = results.map((i) => {
    const [fit, label] = fitScore(i, personas, p.quiz);
    return [i, fit, bestScore(i, fit), label];
  });
  const useTrue = p.use_true;
  const pr = (i: Item) => (useTrue ? i.true_price : i.price);
  const notCancelled = scored.filter((s) => s[0].status !== "cancelled");
  const live = notCancelled.length ? notCancelled : scored;

  const headline: Record<string, Record<string, number | string>> = {};
  if (live.length) {
    const b = live.reduce((a, s) => (s[2] > a[2] ? s : a));
    headline.best = { fit: b[1] !== null ? b[1] : pyRound(b[2] * 100), price: pr(b[0]) };
    headline.cheapest = { price: Math.min(...live.map((s) => pr(s[0]))) };
    headline.soonest = { date: live.reduce((a, s) => (s[0].start < a ? s[0].start : a), live[0][0].start) };
    headline.shortest = { days: Math.min(...live.map((s) => s[0].duration)) };
    const rated = live.map((s) => s[0].rating).filter((r) => r !== null);
    if (rated.length) headline.rated = { rating: Math.max(...rated) };
    headline.verified = { count: live.filter((s) => s[0].op.verified_status === "verified").length };
  }

  const key = sortKey(p.sort, useTrue);
  scored.sort((a, b) => cmpTuple(key(a), key(b)));
  type Cluster = {
    trip_id: string;
    lead: Card;
    departures: { dep_id: string; start: string; end: string; price: number; true_price: number; seats_left: number | null; status: string; fit: number | null }[];
    count?: number;
    from_price?: number;
  };
  const clusters = new Map<string, Cluster>();
  for (const [i, fit, best, label] of scored) {
    let c = clusters.get(i.trip_id);
    if (!c) {
      c = { trip_id: i.trip_id, lead: card(i, fit, label, best), departures: [] };
      clusters.set(i.trip_id, c);
    }
    c.departures.push({ dep_id: i.dep_id, start: i.start, end: i.end, price: i.price, true_price: i.true_price,
                        seats_left: i.seats_left, status: i.status, fit });
  }
  const order = [...clusters.values()];
  for (const c of order) {
    c.departures.sort((a, b) => cmpTuple([a.start], [b.start]));
    c.count = c.departures.length;
    c.from_price = Math.min(...c.departures.map((d) => (useTrue ? d.true_price : d.price)));
  }

  const weeks = new Map<string, [number, number]>();
  const months = new Map<string, [number, number]>();
  for (const [i, f] of rows) {
    if (f.length || i.status === "cancelled") continue;
    const wk = addDays(i.start, -weekday(i.start));
    const mk = i.start.slice(0, 7);
    for (const [m, k] of [[weeks, wk], [months, mk]] as const) {
      const e = m.get(k) ?? [BIG, 0];
      m.set(k, [Math.min(e[0], pr(i)), e[1] + 1]);
    }
  }
  type MapPin = { min_price: number; count: number; slug?: string; destination?: string; lat?: number; lng?: number; image?: string | null; curated?: boolean; dtype?: string };
  type CalDay = { min_price: number; count: number; deps: { dep_id: string; trip_id: string; title: string; price: number; status: string; op: string; duration: number }[] };
  const mp = new Map<string, MapPin>();
  const cal = new Map<string, CalDay>();
  for (const i of results) {
    let m = mp.get(i.dest_slug);
    if (!m) mp.set(i.dest_slug, (m = { min_price: BIG, count: 0 }));
    // our own destination photo where we have one, otherwise the trip's
    const own = DEST_BY_SLUG.get(i.dest_slug)?.image ?? null;
    Object.assign(m, { slug: i.dest_slug, destination: i.destination, lat: i.lat, lng: i.lng, image: own ?? i.image, curated: own !== null, dtype: i.dtype });
    m.min_price = Math.min(m.min_price, pr(i));
    m.count += 1;
    let c = cal.get(i.start);
    if (!c) cal.set(i.start, (c = { min_price: BIG, count: 0, deps: [] }));
    c.min_price = Math.min(c.min_price, pr(i));
    c.count += 1;
    if (c.deps.length < 6) {
      c.deps.push({ dep_id: i.dep_id, trip_id: i.trip_id, title: i.title, price: pr(i), status: i.status, op: i.op.name, duration: i.duration });
    }
  }
  const byKey = <T>(m: Map<string, T>) => [...m].sort((a, b) => cmpTuple([a[0]], [b[0]]));

  return {
    total_departures: results.length, total_trips: order.length,
    total_operators: new Set(results.map((i) => i.op.id)).size,
    headline, clusters: order.slice(offset, offset + limit), has_more: offset + limit < order.length,
    facets,
    // a search for one place gets its season, shown on the price strip
    season: (() => { const dest = p.q ? matchDestination(p.q) : null; const s = seasonInfo(dest?.slug); return dest && s ? { destination: dest.name, ...s } : null; })(),
    // a search for one exact destination (Spin the globe) also gets its "Did you know?" facts
    facts: factsFor(p.dest || null),
    price_strip: {
      weeks: byKey(weeks).map(([k, v]) => ({ week: k, min_price: v[0], count: v[1] })),
      months: byKey(months).map(([k, v]) => ({ month: k, min_price: v[0], count: v[1] })),
    },
    map: [...mp.values()].sort((a, b) => a.min_price - b.min_price),
    calendar: byKey(cal).map(([k, v]) => ({ date: k, ...v })),
    price_bounds: { min: STATE.pmin, max: STATE.pmax },
    relaxations: results.length < 6 ? relaxations(params, p, results.length) : [],
  };
}

export function count(params: Params): number {
  return filter(normalize(params)).length;
}

type Patch = Record<string, string | null>;

function relaxations(params: Params, p: Normalized, n: number) {
  const cands: [string, Patch][] = [];
  if (p.start && p.flex !== "any" && p.flex !== "month") {
    cands.push(["Extend dates ±3 days", { flex: String(flexDays(p.flex) + 3) }]);
    cands.push(["Search the whole month", { flex: "month" }]);
  }
  if (p.max_price) cands.push(["Raise budget 15%", { max_price: String(Math.trunc(p.max_price * 1.15)) }]);
  const g = p.sel.gender;
  if (g.length && !g.includes("mixed")) cands.push(["Include mixed groups", { gender: [...g, "mixed"].join(",") }]);
  for (const [k, v] of Object.entries(p.sel)) {
    if (v.length && k !== "gender") cands.push([`Drop ${GROUP_LABEL[k]} filter`, { [k]: null }]);
  }
  if (p.seats) cands.push(["Fewer seats needed", { seats: null }]);
  if (p.q) cands.push(["Search anywhere", { q: null }]);
  const out: { label: string; patch: Patch; add: number }[] = [];
  for (const [label, patch] of cands) {
    const np: Params = { ...params };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete np[k];
      else np[k] = v;
    }
    const add = count(np) - n;
    if (add > 0) out.push({ label, patch, add });
  }
  out.sort((a, b) => b.add - a.add);
  return out.slice(0, 4);
}

export function itemsForTrip(tripId: string): Item[] {
  return upcoming().filter((i) => i.trip_id === tripId).sort((a, b) => cmpTuple([a.start], [b.start]));
}

/** Any departure, past ones included, so a saved or shared link to one still opens. */
export function itemByDep(depId: string): Item | undefined {
  return STATE.items.find((i) => i.dep_id === depId);
}

import { addDays, cmpTuple, lookup, monthEnd, monthStart, parseISODate, pyInt, pyRound, pySum, weekday } from "./utils.js";
import { DEST_BY_SLUG } from "./destinations.js";
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
const PERSONAS = ["solo_woman", "solo_man", "friends", "couple", "parents", "family", "senior_solo", "senior_group", "corporate"];
const GENDERS = ["women_only", "mixed"];
const AGE_BANDS = ["18-25", "25-35", "35-45", "45-60", "60+"];
const CLIMATES = ["snow", "beach", "mountains", "desert", "jungle", "city"];
const DURS = ["2-5", "6-9", "10-14", "15+"];
export const STYLES = ["hiking", "offbeat", "luxury", "backpacking", "culture_food", "beaches", "wildlife", "spiritual",
                       "roadtrip", "photography", "party", "workation", "winter"];
const OP_CATS = ["community", "trekking", "scuba", "women_specialist", "hostel", "aggregator", "legacy", "seniors", "luxury"];
const PERSONA_LABEL: Record<string, string> = {
  solo_woman: "Great for solo women", solo_man: "Great for solo men", friends: "Great for friend groups",
  couple: "Couple-friendly", parents: "Easy on parents", family: "Family-friendly",
  senior_solo: "Comfortable for 60+ solo", senior_group: "Ideal for 60+ groups", corporate: "Built for teams",
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
                   "meeting_point", "price", "true_price", "breakdown", "flights_est", "seats_total", "seats_left",
                   "status", "min_group", "max_group", "age_band", "age_median", "age_range", "gender_split",
                   "gender_policy", "solo_ratio", "booked", "categories", "rating", "review_count",
                   "last_verified_days", "op", "women_leader", "stay_tier", "pace", "difficulty"] as const;

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
    case "solo_woman": return a.includes("solo") && ["women_only", "mostly_women", "mixed"].includes(g);
    case "solo_man": return a.includes("solo") && ["mixed", "mostly_men", "men_only"].includes(g);
    case "friends": return a.includes("friends");
    case "couple": return a.includes("couples") && !["women_only", "men_only"].includes(g);
    case "parents": return a.includes("parents");
    case "family": return a.includes("family") || i.kid_friendly;
    case "senior_solo": return a.includes("seniors_solo");
    case "senior_group": return a.includes("seniors_group");
    case "corporate": return a.includes("corporate");
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
    const ratings = rv.get(t.id) ?? (o.rating !== null ? [o.rating] : []);
    const intl = t.domestic_or_international === "international";
    items.push({
      dep_id: d.id, trip_id: t.id, title: t.title, dest_slug: t.destination_slug,
      destination: dest?.name ?? (t.destinations.length ? t.destinations[0] : ""),
      region: dest?.region ?? "", countries: t.country, dtype: t.domestic_or_international,
      climate: t.climate_tags, lat: dest?.lat ?? 0, lng: dest?.lng ?? 0,
      image: t.image || dest?.image || null, url: t.url ?? null, source: t.source ?? null, start, end, duration: t.duration_days, meeting_point: t.meeting_point,
      price: d.price_inr, true_price: tp, breakdown: lines,
      flights_est: !intl || t.source === "import" || lookup(t.inclusions, "flights_included", false) ? 0 : (dest?.flight_est ?? 0),
      seats_total: d.seats_total, seats_left: d.seats_left, status: d.status,
      min_group: t.min_group, max_group: t.max_group, age_band: t.age_band,
      age_median: s.age_median, age_range: s.age_range, gender_split: s.gender_split,
      gender_policy: t.gender_policy, solo_ratio: s.solo_ratio, booked: s.booked_count,
      categories: t.categories, audience: t.audience_tags, pace: t.pace, difficulty: t.difficulty,
      stay_tier: t.stay_tier, private_room: t.private_room ?? false, kid_friendly: t.kid_friendly,
      senior_friendly: t.senior_friendly, medical_support: t.medical_support,
      women_leader: t.women_leader ?? false, visa_easy: t.visa_easy ?? !t.visa_required,
      diet: t.diet_options, inclusions: t.inclusions,
      rating: ratings.length ? pyRound(pySum(ratings) / ratings.length, 1) : null, review_count: t.review_count ?? ratings.length,
      last_verified_days: Math.max(0, Math.floor((now - lv) / 86_400_000)),
      op: {
        id: o.id, name: o.name, category: o.category, verified_status: o.verified_status,
        instagram: o.instagram || null, instagram_followers: o.instagram_followers ?? null,
        instagram_followers_at: o.instagram_followers_at ?? null, instagram_followers_source: o.instagram_followers_source ?? null,
        ratings: o.external_ratings ?? [],
        initials: o.name.replaceAll("&", "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(),
      },
      text: [t.title, dest?.name ?? "", dest?.region ?? "", t.country.join(" "), t.destinations.join(" ")].join(" ").toLowerCase(),
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

function dateWindow(p: Normalized): [string, string] | null {
  if (!p.start || p.flex === "any") return null;
  if (p.flex === "month") {
    const s = monthStart(p.start);
    let e = monthEnd(s);
    if (p.end && p.end > e) e = p.end;
    return [s, e];
  }
  const f = flexDays(p.flex);
  return [addDays(p.start, -f), addDays(p.end ?? p.start, f)];
}

function base(i: Item, p: Normalized): boolean {
  if (p.q && !i.text.includes(p.q)) return false;
  const pr = p.use_true ? i.true_price : i.price;
  if (p.min_price !== null && pr < p.min_price) return false;
  if (p.max_price !== null && pr > p.max_price) return false;
  if (p.seats && ((i.seats_left !== null && i.seats_left < p.seats) || i.status === "cancelled")) return false;
  if (p.age_min !== null && (i.age_median === null || i.age_median < p.age_min)) return false;
  if (p.age_max !== null && (i.age_median === null || i.age_median > p.age_max)) return false;
  return true;
}

function inWindow(i: Item, w: [string, string] | null): boolean {
  return w === null || (w[0] <= i.start && i.start <= w[1]);
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
  return STATE.items.filter((i) => base(i, p) && inWindow(i, w) && active.every(([k, v]) => passes(i, k, v)));
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
    } else if (pz === "solo_man") {
      s += lookup({ men_only: 22, mostly_men: 20, mixed: 16 }, g, 0) + sr * 14;
    } else if (pz === "couple") {
      s += (i.private_room ? 22 : 0) + (g === "mixed" ? 10 : 0) + (i.pace !== "adventurous" ? 8 : 0);
    } else if (pz === "friends") {
      s += (size(i) !== "small" ? 15 : 6) + (i.age_band !== null && ["18-25", "25-35"].includes(i.age_band) ? 12 : 4)
        + (i.categories.includes("party") || i.categories.includes("backpacking") ? 8 : 0);
    } else if (pz === "parents") {
      s += (i.senior_friendly ? 16 : 0) + (i.pace === "slow" ? 14 : 4) + (i.difficulty === "easy" ? 10 : 0);
    } else if (pz === "family") {
      s += (i.kid_friendly ? 28 : 0) + (i.difficulty === "easy" ? 10 : 0);
    } else if (pz === "senior_solo") {
      s += (i.senior_friendly ? 15 : 0) + (i.medical_support ? 14 : 0) + sr * 10;
    } else if (pz === "senior_group") {
      s += (i.senior_friendly ? 18 : 0) + (i.medical_support ? 12 : 0) + (i.pace === "slow" ? 10 : 0);
    } else if (pz === "corporate") {
      s += (size(i) === "large" ? 20 : 8) + (i.duration <= 5 ? 15 : 4);
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
      case "soonest": return [c, i.start, pr];
      case "shortest": return [c, i.duration, pr];
      case "rated": return [c, -(i.rating ?? 0), -i.review_count];
      case "verified": return [c, lookup({ verified: 0, pending: 1, unverified: 2 }, i.op.verified_status, 3), i.last_verified_days];
      default: return [c, -best];
    }
  };
}

export function search(params: Params, offset = 0, limit = 30) {
  const p = normalize(params);
  const w = dateWindow(p);
  const active = activeFacets(p);
  const rows: [item: Item, fails: string[], inDates: boolean][] = [];
  for (const i of STATE.items) {
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
  return STATE.items.filter((i) => i.trip_id === tripId).sort((a, b) => cmpTuple([a.start], [b.start]));
}

export function itemByDep(depId: string): Item | undefined {
  return STATE.items.find((i) => i.dep_id === depId);
}

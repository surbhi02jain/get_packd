import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEST_BY_SLUG } from "./destinations.js";
import { PyRandom, addDays, titleCase } from "./utils.js";
import type { Departure, Destination, ExternalRating, ExternalReview, Inclusion, Inclusions, ItineraryDay, Operator, Trip } from "./types.js";
import type { Listing } from "./importReviews.js";

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

interface OperatorRow {
  id: string;
  name: string;
  category: string;
  website: string;
  instagram: string;
  /** Optional hand-entered figure, used when data/instagram.json has none for this operator. */
  instagram_followers?: number;
}

interface InstagramAccount {
  handle: string;
  followers: number;
  source?: string;
  as_of?: string;
  fetched_at: string;
}

interface ImportedTrip {
  operator_id: string;
  url: string;
  title: string;
  image: string | null;
  destination_slug: string;
  duration_days: number | null;
  meeting_point: string | null;
  end_point: string | null;
  inclusions: string[];
  exclusions: string[];
  gst_included: boolean | null;
  women_only: boolean;
  departures: { start: string; end: string | null; price: number; seats_total: number | null; seats_left: number | null }[];
  fetched_at?: string;
}

const readJson = <T>(name: string): T => JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8"));

const readImport = () => readJson<{ fetched_at: string; trips: ImportedTrip[] }>("trips.json");
// written by `yarn import:instagram`; absent until that has been run
const readInstagram = () => (existsSync(path.join(DATA_DIR, "instagram.json"))
  ? readJson<{ fetched_at: string; accounts: Record<string, InstagramAccount> }>("instagram.json")
  : { fetched_at: "", accounts: {} as Record<string, InstagramAccount> });

// written by `yarn import:reviews`; absent until a Google or Tripadvisor key has been set and it has run
const readReviews = () => (existsSync(path.join(DATA_DIR, "reviews.json"))
  ? readJson<{ fetched_at: string; operators: Record<string, { google?: Listing; tripadvisor?: Listing }> }>("reviews.json")
  : { fetched_at: "", operators: {} as Record<string, { google?: Listing; tripadvisor?: Listing }> });

/** When the Google and Tripadvisor reviews were last read ("" if never). */
export const reviewsFetchedAt = () => readReviews().fetched_at;

/** When the trips were last read from operators' sites. */
export const fetchedAt = () => readImport().fetched_at;

/** When the Instagram follower counts were last read ("" if never). */
export const instagramFetchedAt = () => readInstagram().fetched_at;

/** Changes whenever the trips, follower counts or operator list change, which makes the server reseed its database. */
// bump when loadSeed builds records differently, so a running database is rebuilt with the change
const SEED_SHAPE = 2;
export const seedVersion = () => `shape${SEED_SHAPE}-import-${fetchedAt()}-${readInstagram().fetched_at}-${readReviews().fetched_at}-${readFileSync(path.join(DATA_DIR, "operators.json")).length}`;

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Trip styles are inferred from words in the operator's own title; nothing else about a trip is guessed.
const STYLE_WORDS: [string, RegExp][] = [
  ["hiking", /\b(trek|trekking|hike|hiking|summit|base camp|pass)\b/i],
  ["backpacking", /\bbackpack(ing|er)?\b/i],
  ["roadtrip", /\b(road ?trip|bike|biking|motorcycle|circuit|expedition)\b/i],
  ["beaches", /\b(beach|island|islands|coast|coastal|andaman|goa|bali|gokarna|maldives|phuket|krabi)\b/i],
  // "frozen" alone also appears in phrases like "frozen in time", so only a frozen river or lake counts
  ["winter", /\b(winter|snow|frozen (river|lake)|chadar|christmas|xmas|northern lights)\b/i],
  ["party", /\b(new year|nye|party|festival|holi|sunburn|hornbill)\b/i],
  ["spiritual", /\b(spiritual|temple|temples|yoga|retreat|dham|jyotirlinga|kedarnath|varanasi|wellness|pilgrim)\b/i],
  ["wildlife", /\b(safari|wildlife|leopard|tiger|kaziranga|corbett|masai)\b/i],
  ["culture_food", /\b(culture|cultural|heritage|food|ruins|ancient|royal)\b/i],
  ["offbeat", /\boffbeat\b/i],
  ["workation", /\bworkation\b/i],
  ["luxury", /\b(luxury|luxe|premium)\b/i],
  ["photography", /\bphotograph(y|ic)\b/i],
];

// What the operator's inclusion list says about each item on the comparison checklist. Plurals count too:
// "Accommodations on sharing basis" is the stay being included.
const INCLUSION_WORDS: [string, RegExp][] = [
  ["local_transport", /\b(transport(ation)?s?|transfers?|tempos?|volvos?|cabs?|bus|buses|vehicles?|taxis?|ferry|ferries)\b/i],
  ["stays", /\b(stays?|accommodations?|hotels?|hostels?|camps?|camping|homestays?|guest ?houses?|resorts?|nights?)\b/i],
  ["meals", /\b(meals?|breakfasts?|lunch(es)?|dinners?|food)\b/i],
  ["permits_visa", /\b(permits?|visas?)\b/i],
  ["guide", /\b(guides?|trip captains?|trip leaders?|trek leaders?|tour leaders?|tour managers?|instructors?|trip leads?)\b/i],
  ["activities", /\b(entry|entries|activity|activities|safaris?|rafting|sightseeing|tickets?)\b/i],
  ["insurance", /\binsurance\b/i],
  ["flights_included", /\b(flights?|airfares?)\b/i],
];

// cities group trips leave from; a city in an inclusion line about the bus, train or flight is where the group sets off
const HUBS = "New Delhi|Delhi|Mumbai|Pune|Bangalore|Bengaluru|Chennai|Hyderabad|Kolkata|Ahmedabad|Chandigarh|Dehradun|Rishikesh|Haridwar|Kathgodam|Jammu|Guwahati|Bagdogra|Siliguri|Kochi|Jaipur";
const TRAVEL_LINE = new RegExp(`\\b(volvo|bus|buses|train|flights?|tempo|traveller|cabs?|transport(ation)?|transfers?|pick ?-?up)\\b[^.;]*?\\bfrom (${HUBS})\\b`, "i");
const FROM_TITLE = new RegExp(`\\bfrom ((?:${HUBS})(?:\\s*(?:&|and|,)\\s*(?:${HUBS}))*)\\b`, "i");

// file names of logos and default share images: "og.webp", "cropped-PTT-logo-2.png", "favicon.png"
const LOGO_FILE = /(^|[-_.])(logo|favicon|og|og-image|default|placeholder)([-_.]|$)/i;

/** Where the group sets off from, as the operator states it, and how we know. */
function startsFrom(title: string, inclusions: string[]): Pick<Trip, "starts_from" | "starts_from_how" | "starts_from_line"> {
  for (const line of inclusions) {
    const m = TRAVEL_LINE.exec(line);
    if (m) return { starts_from: m[3].replace(/^new /i, ""), starts_from_how: "included", starts_from_line: line.trim() };
  }
  const t = FROM_TITLE.exec(title);
  if (t) return { starts_from: t[1].replace(/\s+and\s+/i, " & "), starts_from_how: "title", starts_from_line: null };
  return { starts_from: null, starts_from_how: null, starts_from_line: null };
}

/** The real operators and their imported trips, shaped as database documents. */
export function loadSeed(): { operators: Operator[]; trips: Trip[]; departures: Departure[] } {
  const IMPORT = readImport();
  const INSTAGRAM = readInstagram();
  const REVIEWS = readReviews();
  const withTrips = new Set(IMPORT.trips.map((t) => t.operator_id));
  const operators: Operator[] = readJson<OperatorRow[]>("operators.json").map((o) => {
    // a follower count is only shown for the handle confirmed as the operator's own (linked from their website)
    const acc = INSTAGRAM.accounts[o.id];
    const usable = acc && o.instagram && acc.handle.toLowerCase() === o.instagram.toLowerCase() ? acc : null;
    const manual = !usable && o.instagram && typeof o.instagram_followers === "number" ? o.instagram_followers : null;
    const listed = (["google", "tripadvisor"] as const).flatMap((source) => {
      const l = REVIEWS.operators[o.id]?.[source];
      return l ? [{ source, l }] : [];
    });
    const external_ratings: ExternalRating[] = listed.map(({ source, l }) => ({ source, rating: l.rating, count: l.count, url: l.url, rating_image: l.rating_image ?? null, as_of: l.as_of }));
    const external_reviews: ExternalReview[] = listed.flatMap(({ l }) => l.reviews);
    return {
    id: o.id, name: o.name, category: o.category, bio: "", website: o.website, instagram: o.instagram,
    instagram_followers: usable?.followers ?? manual,
    instagram_followers_at: usable ? (usable.as_of ?? usable.fetched_at) : null,
    instagram_followers_source: usable ? (usable.source ?? "instagram-api") : manual !== null ? "manual" : null,
    external_ratings, external_reviews,
    // "listed": taken from the shared operator list; getPackd has not vetted these companies
    verified_status: "listed", verification: {}, years_active: null, rating: null, review_count: 0, leaders: [],
    sample: false, source: "import", trips_imported: withTrips.has(o.id),
    };
  });
  const known = new Set(operators.map((o) => o.id));
  const trips: Trip[] = [];
  const departures: Departure[] = [];
  // a site's default share image (its logo, or one picture on every page) isn't a photo of the trip; those trips use
  // the destination's photo instead
  const uses = new Map<string, number>();
  for (const t of IMPORT.trips) if (t.image) uses.set(`${t.operator_id} ${t.image}`, (uses.get(`${t.operator_id} ${t.image}`) ?? 0) + 1);
  const siteImage = (t: ImportedTrip) => !!t.image && ((uses.get(`${t.operator_id} ${t.image}`) ?? 0) >= 3 || LOGO_FILE.test(t.image.split("?")[0].split("/").pop() ?? ""));
  for (const t of IMPORT.trips) {
    const dest = DEST_BY_SLUG.get(t.destination_slug);
    if (!dest || !known.has(t.operator_id)) continue;
    const id = `${t.operator_id}-${slugify(t.title).slice(0, 40)}-${createHash("sha1").update(t.url).digest("hex").slice(0, 6)}`;
    const first = t.departures[0];
    const duration = t.duration_days ?? (first?.end ? Math.round((Date.parse(first.end) - Date.parse(first.start)) / 86_400_000) + 1 : 1);
    const inclusions: Inclusions = {};
    for (const [key, words] of INCLUSION_WORDS) {
      if (t.inclusions.some((line) => words.test(line))) inclusions[key] = true;
      else if (t.exclusions.some((line) => words.test(line))) inclusions[key] = false;
    }
    if (t.gst_included !== null) inclusions.taxes = t.gst_included;
    const intl = dest.dtype === "international";
    trips.push({
      id, operator_id: t.operator_id, title: t.title, destination_slug: dest.slug,
      destinations: dest.places, country: dest.countries, domestic_or_international: dest.dtype,
      climate_tags: dest.climate, meeting_point: t.meeting_point ?? "", end_point: t.end_point ?? "", ...startsFrom(t.title, t.inclusions),
      duration_days: duration, categories: STYLE_WORDS.filter(([, words]) => words.test(t.title)).map(([style]) => style),
      audience_tags: t.women_only ? ["solo", "friends"] : ["solo", "friends", "couples"],
      pace: null, difficulty: null, stay_tier: null, room_sharing: "", private_room: false,
      min_group: null, max_group: first?.seats_total ?? null, age_band: null, gender_policy: t.women_only ? "women_only" : "mixed",
      kid_friendly: false, senior_friendly: false, medical_support: false,
      visa_required: intl && !dest.visa_easy, visa_easy: dest.visa_easy,
      diet_options: [], itinerary_days: [], inclusions, inclusion_list: t.inclusions, exclusions: t.exclusions,
      cancellation_policy: "", leader: null, women_leader: false, image: siteImage(t) ? null : t.image, review_count: 0,
      sample: false, source: "import", url: t.url,
    });
    for (const d of t.departures) {
      departures.push({
        id: `${id}-${d.start}`, trip_id: id, start_date: d.start, end_date: d.end ?? addDays(d.start, duration - 1), price_inr: d.price,
        seats_total: d.seats_total, seats_left: d.seats_left,
        status: d.seats_left !== null && d.seats_left <= 3 ? "filling" : "open", last_verified_at: t.fetched_at ?? IMPORT.fetched_at,
      });
    }
  }
  return { operators, trips, departures };
}

// Used by the admin "add trip" form to draft a day-by-day outline for a hand-entered trip.
export function itinerary(rng: PyRandom, dest: Destination, days: number, tier: string, meals: Inclusion): ItineraryDay[] {
  const hl = dest.highlights;
  const places = dest.places;
  const out: ItineraryDay[] = [];
  for (let n = 1; n <= days; n++) {
    const place = places.length ? places[Math.min(places.length - 1, Math.floor(((n - 1) * places.length) / days))] : dest.name;
    let title: string;
    let desc: string;
    if (n === 1) {
      title = `Meet at ${(dest.meeting || dest.name).split(",")[0]}`;
      desc = `Group meets at ${dest.meeting || dest.name}. Welcome circle, briefing and an easy evening in ${place}.`;
    } else if (n === days) {
      title = "Farewell & drop";
      desc = `Slow breakfast, swap photos and drop at ${dest.end || dest.name}.`;
    } else {
      const h = hl.length ? hl[(n - 2) % hl.length] : `Explore ${dest.name}`;
      title = h;
      desc = rng.choice([
        `${h}. Afternoon free to wander ${place} with optional add-ons.`,
        `Early start for ${h.toLowerCase()}, picnic lunch and a group dinner in ${place}.`,
        `${h}, followed by a local-host experience and an unhurried evening.`,
      ]);
    }
    const m = meals === true ? ["B", "L", "D"] : meals === "partial" ? ["B", "D"] : n > 1 ? ["B"] : [];
    out.push({ day: n, title, description: desc, place, stay: n === days ? null : `${titleCase(tier)} stay · ${place}`, meals: n < days ? m : ["B"] });
  }
  return out;
}

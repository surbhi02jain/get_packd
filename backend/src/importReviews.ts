// Reads Google Maps and Tripadvisor ratings and reviews for the listed operators and writes data/reviews.json.
// The server runs it alongside the trip refresh when the figures are more than a week old;
// `yarn import:reviews` runs it by hand.
//
// Neither site is scraped (both forbid it). Their official APIs are used, each switched on by its key in backend/.env:
//   GOOGLE_PLACES_API_KEY   Google Places API (New): rating, review count and up to 5 reviews per place.
//   TRIPADVISOR_API_KEY     Tripadvisor Content API: rating, review count and up to 5 reviews per location.
// A listing is used only when it links to the operator's own website, so a similarly named business is never picked up.
// When the search can't find it, set `google_place_id` or `tripadvisor_id` on the operator in data/operators.json.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { ExternalReview } from "./types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const GOOGLE = "https://places.googleapis.com/v1";
const TRIPADVISOR = "https://api.content.tripadvisor.com/api/v1";
// Google's terms allow keeping Places content for a limited time only, so a figure that can't be re-read is dropped after this
const KEEP_DAYS = 30;

interface OperatorRow {
  id: string;
  name: string;
  website: string;
  google_place_id?: string;
  tripadvisor_id?: string;
}

export interface Listing {
  /** The Google place id or Tripadvisor location id. */
  id: string;
  rating: number;
  count: number;
  url: string;
  rating_image?: string | null;
  reviews: ExternalReview[];
  as_of: string;
}

type Source = "google" | "tripadvisor";

/** "www.Foo.com/path" -> "foo.com", for comparing a listing's website with the operator's. */
export const domainOf = (url: string | null | undefined) => {
  if (!url) return "";
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

const sameSite = (a: string, b: string) => Boolean(a && b) && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const body = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } | string; message?: string };
  if (!r.ok) {
    const e = body.error;
    throw new Error(`HTTP ${r.status}: ${typeof e === "string" ? e : e?.message ?? body.message ?? "request refused"}`);
  }
  return body;
}

// ---------- Google Places API (New) ----------
interface Place {
  id: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    publishTime?: string;
    relativePublishTimeDescription?: string;
    googleMapsUri?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
}

const PLACE_FIELDS = ["id", "rating", "userRatingCount", "websiteUri", "googleMapsUri", "reviews"];

async function fromGoogle(op: OperatorRow, key: string): Promise<Listing> {
  const headers = { "X-Goog-Api-Key": key, "Content-Type": "application/json" };
  let place: Place | undefined;
  if (op.google_place_id) {
    place = await getJson<Place>(`${GOOGLE}/places/${encodeURIComponent(op.google_place_id)}`, { headers: { ...headers, "X-Goog-FieldMask": PLACE_FIELDS.join(",") } });
  } else {
    const site = domainOf(op.website);
    if (!site) throw new Error("no website to confirm a listing against");
    for (const textQuery of [op.name, `${op.name} travel`]) {
      const body = await getJson<{ places?: Place[] }>(`${GOOGLE}/places:searchText`, {
        method: "POST",
        headers: { ...headers, "X-Goog-FieldMask": PLACE_FIELDS.map((f) => `places.${f}`).join(",") },
        body: JSON.stringify({ textQuery, regionCode: "IN", languageCode: "en", pageSize: 10 }),
      });
      // an operator with several offices has several places; the one with the most ratings stands for it
      place = (body.places ?? []).filter((p) => sameSite(domainOf(p.websiteUri), site)).sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))[0];
      if (place) break;
    }
    if (!place) throw new Error(`no Google listing links to ${site}`);
  }
  if (!place.rating || !place.userRatingCount) throw new Error("the Google listing has no ratings yet");
  return {
    id: place.id,
    rating: place.rating,
    count: place.userRatingCount,
    url: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    reviews: (place.reviews ?? []).filter((r) => r.rating && (r.originalText?.text || r.text?.text)).map((r) => ({
      source: "google" as const,
      author: r.authorAttribution?.displayName ?? "Google user",
      author_url: r.authorAttribution?.uri ?? null,
      author_photo: r.authorAttribution?.photoUri ?? null,
      rating: r.rating!,
      text: (r.originalText?.text || r.text?.text)!,
      date: r.publishTime ?? null,
      relative: r.relativePublishTimeDescription ?? null,
      url: r.googleMapsUri ?? null,
    })),
    as_of: new Date().toISOString(),
  };
}

// ---------- Tripadvisor Content API ----------
interface TaDetails {
  location_id: string;
  website?: string;
  web_url?: string;
  rating?: string;
  num_reviews?: string;
  rating_image_url?: string;
}

interface TaReview {
  rating?: number;
  title?: string;
  text?: string;
  published_date?: string;
  url?: string;
  user?: { username?: string; avatar?: { small?: string } };
}

async function fromTripadvisor(op: OperatorRow, key: string): Promise<Listing> {
  // keys can be limited to a domain in Tripadvisor's dashboard; the referer then has to match it
  const headers: Record<string, string> = { accept: "application/json", ...(process.env.TRIPADVISOR_REFERER ? { Referer: process.env.TRIPADVISOR_REFERER } : {}) };
  const q = (p: Record<string, string>) => new URLSearchParams({ key, language: "en", ...p }).toString();
  const details = (id: string) => getJson<TaDetails>(`${TRIPADVISOR}/location/${encodeURIComponent(id)}/details?${q({ currency: "INR" })}`, { headers });
  let loc: TaDetails | undefined;
  if (op.tripadvisor_id) {
    loc = await details(op.tripadvisor_id);
  } else {
    const site = domainOf(op.website);
    if (!site) throw new Error("no website to confirm a listing against");
    const found = await getJson<{ data?: { location_id: string }[] }>(`${TRIPADVISOR}/location/search?${q({ searchQuery: op.name })}`, { headers });
    for (const c of (found.data ?? []).slice(0, 5)) {
      const d = await details(c.location_id);
      if (sameSite(domainOf(d.website), site)) {
        loc = d;
        break;
      }
    }
    if (!loc) throw new Error(`no Tripadvisor listing links to ${site}`);
  }
  const rating = Number(loc.rating), count = Number(loc.num_reviews);
  if (!rating || !count) throw new Error("the Tripadvisor listing has no reviews yet");
  const reviews = await getJson<{ data?: TaReview[] }>(`${TRIPADVISOR}/location/${encodeURIComponent(loc.location_id)}/reviews?${q({ limit: "5" })}`, { headers });
  return {
    id: loc.location_id,
    rating,
    count,
    url: loc.web_url ?? `https://www.tripadvisor.in/${loc.location_id}`,
    rating_image: loc.rating_image_url ?? null,
    reviews: (reviews.data ?? []).filter((r) => r.rating && r.text).map((r) => ({
      source: "tripadvisor" as const,
      author: r.user?.username ?? "Tripadvisor member",
      author_photo: r.user?.avatar?.small ?? null,
      rating: r.rating!,
      title: r.title ?? null,
      text: r.text!,
      date: r.published_date ?? null,
      url: r.url ?? null,
    })),
    as_of: new Date().toISOString(),
  };
}

/** Which review sources have a key set. */
export const reviewSources = (): Source[] => [
  ...(process.env.GOOGLE_PLACES_API_KEY ? (["google"] as const) : []),
  ...(process.env.TRIPADVISOR_API_KEY ? (["tripadvisor"] as const) : []),
];

export async function runReviewImport(log: (line: string) => void = () => {}) {
  const sources = reviewSources();
  if (!sources.length) throw new Error("Set GOOGLE_PLACES_API_KEY and/or TRIPADVISOR_API_KEY in backend/.env to read reviews");
  const file = path.join(ROOT, "data", "reviews.json");
  let previous: Record<string, Partial<Record<Source, Listing>>> = {};
  try {
    previous = JSON.parse(await readFile(file, "utf8")).operators ?? {};
  } catch {
    previous = {};
  }
  const operators: OperatorRow[] = JSON.parse(await readFile(path.join(ROOT, "data", "operators.json"), "utf8"));
  const out: Record<string, Partial<Record<Source, Listing>>> = {};
  const failed: { operator_id: string; source: Source; reason: string }[] = [];
  for (const op of operators) {
    const line: string[] = [];
    for (const source of sources) {
      try {
        const l = source === "google" ? await fromGoogle(op, process.env.GOOGLE_PLACES_API_KEY!) : await fromTripadvisor(op, process.env.TRIPADVISOR_API_KEY!);
        (out[op.id] ??= {})[source] = l;
        line.push(`${source} ${l.rating} (${l.count})`);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        failed.push({ operator_id: op.id, source, reason });
        // a brief outage shouldn't wipe a rating, but nothing is kept past the time Google allows
        const old = previous[op.id]?.[source];
        if (old && Date.now() - Date.parse(old.as_of) < KEEP_DAYS * 86_400_000) (out[op.id] ??= {})[source] = old;
        line.push(`${source} ${old && out[op.id]?.[source] ? "kept previous" : "none"}: ${reason}`);
      }
    }
    log(`${op.name.padEnd(34)} ${line.join("  |  ")}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  // sources without a key this run keep their recent figures rather than vanishing
  for (const [id, entry] of Object.entries(previous)) {
    for (const source of ["google", "tripadvisor"] as Source[]) {
      const old = entry[source];
      if (!sources.includes(source) && old && Date.now() - Date.parse(old.as_of) < KEEP_DAYS * 86_400_000) (out[id] ??= {})[source] = old;
    }
  }
  const fetched_at = new Date().toISOString();
  await mkdir(path.join(ROOT, "data"), { recursive: true });
  await writeFile(file, JSON.stringify({ fetched_at, sources, operators: out, failed }, null, 1));
  const count = (s: Source) => Object.values(out).filter((e) => e[s]).length;
  return { fetched_at, sources, google: count("google"), tripadvisor: count("tripadvisor"), failed: failed.length };
}

// run only when started directly (`yarn import:reviews`), not when the server imports this file
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReviewImport(console.log)
    .then((r) => console.log(`\nWrote data/reviews.json from ${r.sources.join(" and ")}: ${r.google} operators with a Google rating, ${r.tripadvisor} with a Tripadvisor rating. Restart the backend to show them.`))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}

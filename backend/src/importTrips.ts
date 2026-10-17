// Importer: reads upcoming group departures from operators' public trip pages and writes data/trips.json,
// which the server seeds from. The server runs it on a schedule (see server.ts); `yarn import:trips` runs it by hand.
//
// Only facts published on the operator's own page are kept (title, dates, price, seats, inclusion lists).
// Nothing is estimated here. Each site is fetched slowly (one request at a time, with a pause).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchDestination } from "./destinations.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CACHE_DIR = process.env.IMPORT_CACHE_DIR; // optional: reuse downloaded pages between runs
const MAX_TRIPS = Number(process.env.IMPORT_MAX_TRIPS || 15); // trips kept per operator
const MAX_PAGES = Number(process.env.IMPORT_MAX_PAGES || 60); // pages fetched per operator
const MAX_DEPARTURES = 8; // departures kept per trip
const HORIZON_DAYS = 240;
const PAUSE_MS = 1200;

// set at the start of every run, so a long-running server never works from a stale "today"
let TODAY = "";
let HORIZON = "";
function resetClock() {
  TODAY = new Date().toISOString().slice(0, 10);
  HORIZON = new Date(Date.now() + HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10);
}
resetClock();

export interface ImportedDeparture {
  start: string;
  end: string | null;
  price: number;
  seats_total: number | null;
  seats_left: number | null;
}

export interface ImportedTrip {
  operator_id: string;
  url: string;
  title: string;
  image: string | null;
  destination_slug: string;
  duration_days: number | null;
  location: string | null;
  meeting_point: string | null;
  end_point: string | null;
  inclusions: string[];
  exclusions: string[];
  gst_included: boolean | null;
  women_only: boolean;
  departures: ImportedDeparture[];
  /** When this trip was last read from the operator's site. */
  fetched_at?: string;
}

type Draft = Omit<ImportedTrip, "operator_id" | "destination_slug" | "women_only"> & { women_only?: boolean };

// ---------- fetching ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string | null> {
  const cacheFile = CACHE_DIR && path.join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".html");
  if (cacheFile) {
    try {
      return await readFile(cacheFile, "utf8");
    } catch {
      // not cached yet
    }
  }
  await sleep(PAUSE_MS);
  let text: string | null = null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    text = await r.text();
  } catch {
    // a few sites drop Node's connections but accept curl
    text = await new Promise<string | null>((resolve) => {
      execFile("curl", ["-sfL", "-m", "30", "--compressed", "-A", UA, "-H", "Accept-Language: en-IN,en;q=0.9", url], { maxBuffer: 32 * 1024 * 1024 }, (err, out) => resolve(err ? null : out));
    });
  }
  if (text && cacheFile) {
    await mkdir(CACHE_DIR!, { recursive: true });
    await writeFile(cacheFile, text);
  }
  return text;
}

async function sitemapUrls(url: string): Promise<string[]> {
  const xml = (await fetchText(url)) ?? "";
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim());
}

async function linkedUrls(pageUrl: string, pattern: RegExp): Promise<string[]> {
  const html = (await fetchText(pageUrl)) ?? "";
  const base = new URL(pageUrl);
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"#?]+)"/g)) {
    try {
      const u = new URL(m[1], base);
      if (u.host === base.host && pattern.test(u.pathname)) out.add(u.href);
    } catch {
      // not a URL
    }
  }
  return [...out];
}

// ---------- reading pages ----------
const decodeEntities = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;|&apos;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
  .replace(/&#8377;/g, "₹").replace(/&ndash;|&#8211;/g, "–").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function meta(html: string, prop: string): string | null {
  const m = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i").exec(html) ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i").exec(html);
  return m ? decodeEntities(m[1]).trim() : null;
}

function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      for (const o of Array.isArray(j) ? j : (j["@graph"] ?? [j])) if (o && typeof o === "object") out.push(o);
    } catch {
      // malformed block
    }
  }
  return out;
}

/** The text Next.js streams into the page (where its data lives), or the raw HTML for other sites. */
function pageData(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)];
  if (!chunks.length) return html;
  return chunks.map((c) => {
    try {
      return JSON.parse(c[1]) as string;
    } catch {
      return "";
    }
  }).join("");
}

/** Every JSON object in `text` that has `key` as one of its own properties. */
function objectsWithKey(text: string, key: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const needle = `"${key}"`;
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    from = at + needle.length;
    if (!/^\s*:/.test(text.slice(from, from + 4))) continue;
    // walk back to the brace that opens the object holding this key
    let depth = 0;
    let start = -1;
    let inStr = false;
    for (let i = at - 1; i >= 0 && at - i < 400_000; i--) {
      const c = text[i];
      if (c === '"') {
        let b = 0;
        for (let k = i - 1; k >= 0 && text[k] === "\\"; k--) b++;
        if (b % 2 === 0) inStr = !inStr;
      } else if (!inStr) {
        if (c === "}" || c === "]") depth++;
        else if (c === "{" || c === "[") {
          if (depth === 0) {
            if (c === "{") start = i;
            break;
          }
          depth--;
        }
      }
    }
    if (start < 0) continue;
    const end = matchBrace(text, start);
    if (end < 0) continue;
    try {
      const o = JSON.parse(text.slice(start, end + 1));
      if (o && typeof o === "object" && key in o) out.push(o);
    } catch {
      // not JSON after all
    }
  }
  return out;
}

function matchBrace(text: string, start: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const iso = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^[\d,.]+$/.test(v) ? Number(v.replace(/,/g, "")) : null);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** "5N/6D", "6 Days 5 Nights", "7 days" → number of days. */
function durationFrom(text: string): number | null {
  const m = /(\d{1,2})\s*(?:N|Nights?)\s*[/&,\-| ]*\s*(\d{1,2})\s*(?:D|Days?)\b/i.exec(text) ?? /(\d{1,2})\s*(?:D|Days?)\s*[/&,\-| ]*\s*(\d{1,2})\s*(?:N|Nights?)\b/i.exec(text);
  if (m) return Math.max(Number(m[1]), Number(m[2]));
  const d = /\b(\d{1,2})\s*-?\s*Days?\b/i.exec(text);
  return d ? Number(d[1]) : null;
}

/** Bullet points out of an HTML list or a plain array of strings, shortened. */
function bullets(v: unknown): string[] {
  let items: string[] = [];
  if (typeof v === "string") items = [...v.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1]));
  else if (Array.isArray(v)) items = v.map((x) => (typeof x === "string" ? stripTags(x) : typeof x === "object" && x ? stripTags(String((x as Record<string, unknown>).title ?? (x as Record<string, unknown>).text ?? (x as Record<string, unknown>).name ?? "")) : ""));
  return items.filter(Boolean).slice(0, 14).map((s) => (s.length > 140 ? s.slice(0, 137) + "…" : s));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** A day and month with no year means its next occurrence. */
function nextDate(day: number, monthName: string, year?: number): string | null {
  const m = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase());
  if (m < 0 || day < 1 || day > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisYear = Number(TODAY.slice(0, 4));
  if (year) return `${year}-${pad(m + 1)}-${pad(day)}`;
  const d = `${thisYear}-${pad(m + 1)}-${pad(day)}`;
  return d >= TODAY ? d : `${thisYear + 1}-${pad(m + 1)}-${pad(day)}`;
}

// ---------- operators ----------
interface Source {
  /** URLs of trip pages worth reading, best candidates first. */
  discover(): Promise<string[]>;
  /** Reads one page: a single trip, or every trip on a listing page; null when it has nothing usable. */
  read(url: string, html: string): Draft | Draft[] | null;
  womenOnly?: boolean;
}

const slugOf = (url: string) => new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
const visibleText = (html: string) => stripTags(html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, " "));
const empty = { location: null, meeting_point: null, end_point: null, inclusions: [] as string[], exclusions: [] as string[], gst_included: null };

const SOURCES: Record<string, Source> = {
  "tripper-trails": {
    discover: async () => (await sitemapUrls("https://www.trippertrails.in/sitemap.xml")).filter((u) => /\/trip\/[a-z0-9-]+$/.test(u)),
    read(url, html) {
      const trip = objectsWithKey(pageData(html), "trip_departures").find((o) => o.slug === slugOf(url));
      if (!trip) return null;
      const deps = (trip.trip_departures as Record<string, unknown>[]).filter((d) => d.status === "open");
      return {
        url, title: String(trip.title), image: (trip.cover_image_url as string) ?? meta(html, "og:image"),
        duration_days: num(trip.duration_days), location: (trip.destination as string) ?? null, meeting_point: null, end_point: null,
        inclusions: [], exclusions: [], gst_included: typeof trip.price_includes_gst === "boolean" ? trip.price_includes_gst : null,
        departures: deps.map((d) => {
          const total = num(d.capacity);
          const booked = num(d.confirmed_count) ?? 0;
          return { start: iso(d.starts_on)!, end: iso(d.ends_on), price: (num(d.price) ?? 0) - (num(d.discount) ?? 0), seats_total: total, seats_left: total === null ? null : Math.max(0, total - booked) };
        }),
      };
    },
  },

  "capture-a-trip": {
    discover: async () => sitemapUrls("https://www.captureatrip.com/trip/sitemap.xml"),
    read(url, html) {
      const data = pageData(html);
      const trip = objectsWithKey(data, "relatedBatches").find((o) => Array.isArray(o.relatedBatches) && "title" in o);
      if (!trip) return null;
      const batches = (trip.relatedBatches as { batches: Record<string, unknown>[] }[]).flatMap((m) => m.batches ?? []);
      const excl = bullets(trip.exclusions);
      const incl = bullets(trip.inclusions);
      return {
        url, title: String(trip.title).trim(), image: /https:\/\/[^"\\ ]+\/trip\/gallery_images\/[^"\\ ]+\.(?:webp|jpe?g|png)/.exec(data)?.[0] ?? meta(html, "og:image"),
        duration_days: num(batches[0]?.tripDays) ?? durationFrom(String(trip.title)), location: typeof trip.location === "string" ? trip.location : null,
        meeting_point: typeof trip.pickUp === "string" ? trip.pickUp : null, end_point: typeof trip.drop === "string" ? trip.drop : null,
        inclusions: incl, exclusions: excl, gst_included: gstFrom(incl, excl),
        departures: batches.filter((b) => !b.fullyBooked).map((b) => {
          // the cheapest sharing option the operator shows, after its listed discount
          const prices = ((b.costing as Record<string, unknown>[]) ?? []).map((c) => (num(c.price) ?? 0) - (num(c.discount) ?? 0)).filter((p) => p > 0);
          return { start: iso(b.batchDate)!, end: iso(b.endDate), price: prices.length ? Math.min(...prices) : 0, seats_total: num(b.maxSlots), seats_left: num(b.remainSlots) };
        }),
      };
    },
  },

  justwravel: {
    discover: async () => (await sitemapUrls("https://www.justwravel.com/sitemap.xml")).filter((u) => /\/(backpacking-trips|treks|weekend-getaways|biking-trips)\/.+\/[a-z0-9-]+$/.test(u)),
    read(url, html) {
      const data = pageData(html);
      const trip = objectsWithKey(data, "defaultPrice").find((o) => o.slug === slugOf(url));
      const itin = objectsWithKey(data, "daywiseItinerary").find((o) => Array.isArray(o.batches));
      const price = num((trip?.defaultPrice as Record<string, unknown> | undefined)?.discountedPrice) || num((trip?.defaultPrice as Record<string, unknown> | undefined)?.price);
      if (!trip || !itin || !price) return null;
      const text = (v: unknown) => bullets(Array.isArray(v) ? v.map((b) => ((b as { children?: { text?: string }[] }).children ?? []).map((c) => c.text ?? "").join("")) : []);
      const incl = text(itin.inclusions);
      const excl = text(itin.exclusions);
      const loc = trip.categoryAndLocation as Record<string, unknown> | undefined;
      const state = ((trip.loc as Record<string, Record<string, unknown>> | undefined)?.state?.name as string) ?? null;
      return {
        url, title: String(trip.title), image: meta(html, "og:image"), duration_days: num(itin.duration),
        location: state, meeting_point: typeof loc?.location === "string" ? loc.location : null, end_point: null,
        inclusions: incl, exclusions: excl, gst_included: gstFrom(incl, excl),
        departures: (itin.batches as Record<string, unknown>[]).filter((b) => b.availability !== "Sold Out" && b.availability !== "Full").map((b) => {
          const special = num((b.specialPricing as Record<string, unknown> | null)?.price);
          return { start: iso(b.startDate)!, end: iso(b.endDate), price: special || price, seats_total: num(b.slots), seats_left: null };
        }),
      };
    },
  },

  zostel: {
    discover: async () => (await sitemapUrls("https://www.zostel.com/sitemap.xml")).filter((u) => /\/zo-trip\/[^/]+\/[^/]+\/?$/.test(u)),
    read(url, html) {
      const data = pageData(html);
      const trip = objectsWithKey(data, "starting_price").find((o) => "pickup_location" in o);
      const dates = objectsWithKey(data, "batches").map((o) => o.batches).find((b) => Array.isArray(b) && b.every((d) => iso(d)));
      // prices are stored in units of 1e-8 rupees
      const price = trip ? Math.round((num(trip.starting_price) ?? 0) / 1e8) : 0;
      const title = (meta(html, "og:title") ?? "").split(" - ")[0].trim();
      if (!trip || !dates || !price || !title) return null;
      const days = num(trip.duration) ?? durationFrom(title);
      return {
        url, title: `Zo Trip: ${title}`, image: meta(html, "og:image"), duration_days: days, location: null,
        meeting_point: (trip.pickup_location as string) ?? null, end_point: (trip.drop_location as string) ?? null,
        inclusions: [], exclusions: [], gst_included: null,
        departures: (dates as string[]).map((d) => ({ start: d, end: days ? addDays(d, days - 1) : null, price, seats_total: null, seats_left: null })),
      };
    },
  },

  wovoyage: {
    womenOnly: true,
    discover: async () => linkedUrls("https://www.wovoyage.com/", /^\/tour\/[a-z0-9-]+$/),
    read(url, html) {
      const m = /bravo_booking_data\s*=\s*(\{[\s\S]*?\})\s*;?\s*\n?\s*bravo_booking_data\./.exec(html);
      let data: Record<string, unknown> | null = null;
      try {
        data = m ? JSON.parse(m[1]) : null;
      } catch {
        data = null;
      }
      const start = iso(data?.start_date);
      const rooms = ((data?.wo_rooms as Record<string, unknown>[]) ?? []).filter((r) => !r.sold_out).map((r) => num(r.price) ?? 0).filter((p) => p > 0);
      const title = (meta(html, "og:title") ?? "").split("|")[0].trim();
      if (!data || !data.is_fixed_date || !start || !rooms.length || !title) return null;
      const end = /(\d{1,2}) ([A-Za-z]{3}) (\d{4})/.exec(String(data.end_date_html ?? ""));
      const endDate = end ? nextDate(Number(end[1]), end[2], Number(end[3])) : null;
      return {
        url, title, image: meta(html, "og:image"), duration_days: endDate ? daysBetween(start, endDate) + 1 : durationFrom(stripTags(html).slice(0, 20_000)),
        location: null, meeting_point: null, end_point: null, inclusions: [], exclusions: [], gst_included: null,
        departures: [{ start, end: endDate, price: Math.min(...rooms), seats_total: num(data.max_guests), seats_left: null }],
      };
    },
  },

  "jugni-travel": {
    womenOnly: true,
    discover: async () => linkedUrls("https://jugni.co.in/", /^\/solo-women-travel-group\/[a-z0-9-]+\/?$/),
    read(url, html) {
      const title = (meta(html, "og:title") ?? "").split("|")[0].trim();
      const departures: ImportedDeparture[] = [];
      for (const m of html.matchAll(/<p>\s*([A-Z]{3}) (\d{2}) - ([A-Z]{3}) (\d{2})\s*<\/p>([\s\S]{0,500})/g)) {
        const start = nextDate(Number(m[2]), m[1]);
        const after = stripTags(m[5]);
        const price = /₹\s*([\d,]+)/.exec(after);
        const seats = /(\d+)\s+seats? left/i.exec(after);
        if (!start || !price || /sold out/i.test(after)) continue;
        let end = nextDate(Number(m[4]), m[3], Number(start.slice(0, 4)));
        if (end && end < start) end = nextDate(Number(m[4]), m[3], Number(start.slice(0, 4)) + 1);
        departures.push({ start, end, price: Number(price[1].replace(/,/g, "")), seats_total: null, seats_left: seats ? Number(seats[1]) : null });
      }
      if (!title || !departures.length) return null;
      const first = departures[0];
      return { url, title, image: meta(html, "og:image"), duration_days: first.end ? daysBetween(first.start, first.end) + 1 : null, location: null,
               meeting_point: null, end_point: null, inclusions: [], exclusions: [], gst_included: null, departures };
    },
  },

  hikerwolf: {
    discover: async () => (await sitemapUrls("https://hikerwolf.com/trip-sitemap.xml")).filter((u) => /\/events\/[a-z0-9-]+\/?$/.test(u)),
    read(url, html) {
      const trip = jsonLd(html).find((o) => o["@type"] === "Trip" || o["@type"] === "Product");
      const title = String(trip?.name ?? meta(html, "og:title") ?? "").replace(/\s+-\s+HikerWolf$/i, "").trim();
      const departures: ImportedDeparture[] = [];
      // one list item per fixed departure: start date, end date, price, availability
      for (const row of html.split('<li class="wte-fsd__availability">').slice(1)) {
        const dates = [...row.matchAll(/wte-fsd__availability-bold-text">\s*([A-Za-z]+) (\d{1,2}), (\d{4})\s*</g)];
        const price = /sale-price-wrap">[\s\S]{0,200}?(?:&#8377;|₹)\s*([\d,]+)/.exec(row) ?? /(?:&#8377;|₹)\s*([\d,]+)/.exec(row);
        if (dates.length < 1 || !price || !/>\s*Available\s*</.test(row)) continue;
        const start = nextDate(Number(dates[0][2]), dates[0][1], Number(dates[0][3]));
        const end = dates[1] ? nextDate(Number(dates[1][2]), dates[1][1], Number(dates[1][3])) : null;
        if (start) departures.push({ start, end, price: Number(price[1].replace(/,/g, "")), seats_total: null, seats_left: null });
      }
      if (!title || !departures.length) return null;
      const first = departures[0];
      return { url, title, image: meta(html, "og:image"), duration_days: first.end ? daysBetween(first.start, first.end) + 1 : durationFrom(title), location: null,
               meeting_point: null, end_point: null, inclusions: [], exclusions: [], gst_included: null, departures };
    },
  },

  trekkaro: {
    discover: async () => (await sitemapUrls("https://www.trekkaro.com/sitemap-treks.xml")).filter((u) => /\/trek\/[a-z0-9-]+\/?$/.test(u)),
    read(url, html) {
      // every batch is published as a sub-trip with its own dates, price and stock
      const trip = jsonLd(html).find((o) => o["@type"] === "TouristTrip" && Array.isArray(o.subTrip));
      const title = (meta(html, "og:title") ?? "").split(":")[0].replace(/\s+20\d\d(-\d\d)?$/, "").trim();
      if (!trip || !title) return null;
      const departures = (trip.subTrip as Record<string, unknown>[]).map((b) => {
        const offer = (b.offers ?? {}) as Record<string, unknown>;
        return { b, offer, start: iso(b.departureTime), end: iso(b.arrivalTime), price: num(offer.price) ?? 0 };
      }).filter((d) => d.start && String(d.offer.availability ?? "").endsWith("InStock"))
        // the published stock figure is the same for every batch, so it is read as the batch size, not seats left
        .map((d) => ({ start: d.start!, end: d.end, price: d.price, seats_total: num((d.offer.inventoryLevel as Record<string, unknown> | undefined)?.value), seats_left: null }));
      const first = departures[0];
      return { url, title, image: meta(html, "og:image"), duration_days: first?.end ? daysBetween(first.start, first.end) + 1 : null, location: null,
               meeting_point: null, end_point: null, inclusions: [], exclusions: [], gst_included: null, departures };
    },
  },

  trekatribe: {
    discover: async () => linkedUrls("https://www.trekatribe.com/", /^\/tour\/[a-z0-9-]+$/),
    read(url, html) {
      const title = stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
      const price = /₹\s*([\d,]+)\s*(?:₹\s*[\d,]+\s*)?\/\s*per person/i.exec(stripTags(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")));
      const dates = [...html.matchAll(/data-start_date="(\d{4}-\d{2}-\d{2})" data-end_date="(\d{4}-\d{2}-\d{2})"/g)];
      if (!title || !price || !dates.length) return null;
      return { url, title, image: meta(html, "og:image"), duration_days: durationFrom(title), location: null, meeting_point: null, end_point: null,
               inclusions: [], exclusions: [], gst_included: null,
               departures: dates.map((d) => ({ start: d[1], end: d[2], price: Number(price[1].replace(/,/g, "")), seats_total: null, seats_left: null })) };
    },
  },

  "the-flapper-life": {
    womenOnly: true,
    // newest pages are listed last; past events are skipped when read
    discover: async () => (await sitemapUrls("https://theflapperlife.com/sitemap.xml")).filter((u) => /\/events\/(?!categories|locations|calender)[a-z0-9-]+\/$/.test(u)).reverse(),
    read(url, html) {
      const text = stripTags(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " "));
      const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "").split("|")[0].trim();
      const when = (label: string) => new RegExp(`${label} (\\d{1,2}) ([A-Za-z]{3}) (\\d{4})`).exec(text);
      const start = when("Start");
      const end = when("End");
      const price = /Base Price ₹\s*([\d,]+)/.exec(text);
      if (!title || !start || !price || /Booking Closed/i.test(text)) return null;
      const startDate = nextDate(Number(start[1]), start[2], Number(start[3]));
      const endDate = end ? nextDate(Number(end[1]), end[2], Number(end[3])) : null;
      if (!startDate) return null;
      return { url, title, image: meta(html, "og:image") ?? /<img[^>]+src="(https?:\/\/[^"]+\.(?:jpe?g|webp|png)[^"]*)"/i.exec(html)?.[1] ?? null,
               duration_days: endDate ? daysBetween(startDate, endDate) + 1 : durationFrom(text.slice(0, 4000)),
               location: /Location ([A-Za-z ,]+?) (?:Group|Category|Seats|Price|Theme|[A-Z][a-z]+ [A-Z])/.exec(text)?.[1] ?? null, meeting_point: null, end_point: null,
               inclusions: [], exclusions: [],
               // the page lists GST as its own line on top of the base price
               gst_included: /GST \(/.test(text) ? false : null,
               departures: [{ start: startDate, end: endDate, price: Number(price[1].replace(/,/g, "")), seats_total: null, seats_left: null }] };
    },
  },

  backpackclan: {
    // the "all trips" page carries every trip with its next departures
    discover: async () => ["https://backpackclan.com/trips"],
    read(_url, html) {
      const data = pageData(html);
      return objectsWithKey(data, "upcomingDepartures").filter((t) => t.slug && t.title && t.pricePer === "person").map((t) => ({
        ...empty, url: `https://backpackclan.com/trips/${t.slug}`, title: String(t.title),
        image: new RegExp(`"${t.imageId}":"(https://backpackclan\\.com/storage/[^"]+)"`).exec(data)?.[1] ?? null,
        duration_days: durationFrom(String(t.duration ?? "")), location: typeof t.destination === "string" ? t.destination : null,
        departures: ((t.upcomingDepartures as Record<string, unknown>[]) ?? []).filter((d) => d.effectiveStatus === "available" || d.effectiveStatus === "guaranteed")
          // some rows repeat the start date as the end date; the end is then worked out from the trip length
          .map((d) => ({ start: iso(d.startDate)!, end: iso(d.endDate) !== iso(d.startDate) ? iso(d.endDate) : null, price: num(t.price) ?? 0, seats_total: null, seats_left: null })),
      }));
    },
  },

  "trekkers-united": {
    discover: async () => ["https://www.trekkersunited.com/upcoming-trips", "https://www.trekkersunited.com/upcoming-treks"],
    read(_url, html) {
      const drafts: Draft[] = [];
      for (const part of html.split(/(?=title:"[^"]+",slug:"[^"]+",numberOfDays:)/).slice(1)) {
        const head = /^title:"([^"]+)",slug:"([^"]+)",numberOfDays:(\d+)/.exec(part);
        const at = part.indexOf("upcomingBatches:");
        if (!head || at < 0) continue;
        const seats = /totalSeats:(\d+)/.exec(part);
        const image = /originalKey:"([^"]+)"/.exec(part);
        const days = Number(head[3]);
        drafts.push({
          ...empty, url: `https://www.trekkersunited.com/tour/${head[2]}`, title: head[1], image: image ? `https://media.trekkersunited.com/${image[1]}` : null,
          duration_days: days, location: /destinationName:"([^"]+)"/.exec(part)?.[1] ?? null,
          // prices are stored in paise
          departures: [...part.slice(at, at + 4000).matchAll(/startDate:"(\d{4}-\d{2}-\d{2})[^"]*",price:(\d+)/g)]
            .map((b) => ({ start: b[1], end: addDays(b[1], days - 1), price: Math.round(Number(b[2]) / 100), seats_total: seats ? Number(seats[1]) : null, seats_left: null })),
        });
      }
      return drafts;
    },
  },

  "one-in-the-orange-jacket": {
    discover: async () => ["https://oneintheorangejacket.com/all-trips"],
    read(_url, html) {
      const drafts: Draft[] = [];
      for (const m of html.matchAll(/\{\s*id:"[^"]+",name:"([^"]+)",subtitle:"([^"]*)",slug:"([^"]+)",([\s\S]*?)status:"(\w+)"\s*\}/g)) {
        if (m[5] !== "active") continue;
        const body = m[4];
        // only batches priced in rupees are kept; their US-dollar batches are left out rather than converted
        const batches = [...body.matchAll(/startDate:"(\d{4}-\d{2}-\d{2})",endDate:"(\d{4}-\d{2}-\d{2})",price:(\d+),currency:"INR",slots:(\d+|null),slotsLeft:(\d+|null)/g)];
        const hero = /heroImage:"([^"]+)"/.exec(body)?.[1];
        drafts.push({
          ...empty, url: `https://oneintheorangejacket.com/${m[3]}/`, title: m[2] ? `${m[1]}: ${m[2]}` : m[1],
          image: hero ? new URL(hero, "https://oneintheorangejacket.com").href : null,
          duration_days: durationFrom(/duration:"([^"]+)"/.exec(body)?.[1] ?? ""), location: /country:"([^"]+)"/.exec(body)?.[1] ?? null,
          departures: batches.map((b) => ({ start: b[1], end: b[2], price: Number(b[3]), seats_total: b[4] === "null" ? null : Number(b[4]), seats_left: b[5] === "null" ? null : Number(b[5]) })),
        });
      }
      return drafts;
    },
  },

  "metanoia-expeditions": {
    discover: async () => ["https://www.metanoiaexpeditions.com/upcoming-trips"],
    read(_url, html) {
      const drafts: Draft[] = [];
      for (const t of objectsWithKey(html, "tripDate")) {
        if (typeof t.tripDate !== "string" || typeof t.title !== "string" || t.active !== "y" || typeof t.tripLink !== "string") continue;
        const price = /₹\s*([\d,]+)/.exec(String(t.price ?? ""));
        const nights = /(\d+)\s*NIGHTS/i.exec(String(t.spots ?? ""));
        if (!price || !nights) continue; // "multiple" lengths or no price: nothing definite to list
        const days = Number(nights[1]) + 1;
        const image = /wix:image:\/\/v1\/([^/]+)\//.exec(String(t.image ?? ""));
        const starts = t.tripDate.split("|").map((d) => /(\d{1,2})\s+([A-Za-z]{3,})/.exec(d)).map((d) => (d ? nextDate(Number(d[1]), d[2]) : null)).filter((d): d is string => d !== null);
        drafts.push({
          ...empty, url: t.tripLink, title: t.title.trim(), image: image ? `https://static.wixstatic.com/media/${image[1]}` : null, duration_days: days,
          location: typeof t.discription === "string" ? t.discription : null,
          departures: starts.map((start) => ({ start, end: addDays(start, days - 1), price: Number(price[1].replace(/,/g, "")), seats_total: null, seats_left: null })),
        });
      }
      return drafts;
    },
  },

  "the-searching-souls": {
    discover: async () => linkedUrls("https://www.thesearchingsouls.com/", /^\/[a-z0-9-]+-trek\/$/),
    read(url, html) {
      const text = visibleText(html);
      const title = stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
      // the booking calendar marks each departure day as available
      const dates = [...html.matchAll(/class="day available"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g)].map((d) => d[1]);
      const pair = /₹\s*([\d,]+)\s*₹\s*([\d,]+)/.exec(text); // list price followed by the current offer price
      const price = pair ? Math.min(Number(pair[1].replace(/,/g, "")), Number(pair[2].replace(/,/g, ""))) : null;
      const days = /Duration\s*:?\s*(\d{1,2})\s*Days/i.exec(text) ?? /(\d{1,2})\s*Days\b/.exec(text) ?? /(\d{1,2})\s*D\s*\/\s*\d{1,2}\s*N/.exec(text);
      if (!title || !dates.length || !price || !days) return null;
      return { ...empty, url, title, image: meta(html, "og:image"), duration_days: Number(days[1]),
               departures: dates.map((start) => ({ start, end: addDays(start, Number(days[1]) - 1), price, seats_total: null, seats_left: null })) };
    },
  },

  "f5-escapes": {
    womenOnly: true,
    discover: async () => ["https://f5escapes.com/group-tours/"],
    read(_url, html) {
      const ymd = (v: unknown) => (typeof v === "string" && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : null);
      return objectsWithKey(html, "start_date").filter((t) => typeof t.permalink === "string" && typeof t.title === "string" && ymd(t.start_date) && !t.is_sold_out).map((t) => {
        const lists = (t.inclusions_exclusions ?? {}) as Record<string, unknown>;
        const incl = bullets(lists.inclusions ?? lists.inclusion);
        const excl = bullets(lists.exclusions ?? lists.exclusion);
        return {
          url: t.permalink as string, title: t.title as string, image: typeof t.image === "string" ? t.image : null, duration_days: num(t.duration),
          location: Array.isArray(t.states) ? String(t.states[0] ?? "") : null, meeting_point: null, end_point: null,
          inclusions: incl, exclusions: excl, gst_included: gstFrom(incl, excl),
          departures: [{ start: ymd(t.start_date)!, end: ymd(t.end_date), price: num(t.sale_price) ?? num(t.regular_price) ?? 0, seats_total: num(t.seats_capacity), seats_left: num(t.seats_available) }],
        };
      });
    },
  },

  "on-his-own-trip": {
    // the calendar pages list every trip as a card: name, month, day range, length and price
    discover: async () => ["themed-trips", "october-2", "november-2", "december", "september-2"].map((p) => `https://onhisowntrip.com/${p}/`),
    read(_url, html) {
      const drafts: Draft[] = [];
      for (const card of html.split("<figure").slice(1)) {
        const link = /href="(https:\/\/onhisowntrip\.com\/trip\/[a-z0-9-]+\/)"/.exec(card);
        const title = /<h2[^>]*>\s*<a[^>]*>([^<]+)<\/a>/.exec(card);
        const month = /\/trip-types\/([a-z]+)\//.exec(card);
        const when = /Trip Date<\/label>\s*<div[^>]*>\s*<div[^>]*>\s*(\d{1,2})\s*-\s*(?:([A-Za-z]{3,})\s+)?(\d{1,2})/.exec(card);
        const price = /&#8377;<\/span>\s*<span[^>]*>\s*([\d,]+)/.exec(card);
        const days = /(\d{1,2})\s*Days/.exec(card);
        const seats = /No\.?\s*Of Seats:?\s*(\d+)/i.exec(stripTags(card));
        if (!link || !title || !month || !when || !price) continue;
        const start = nextDate(Number(when[1]), month[1]);
        if (!start) continue;
        const end = days ? addDays(start, Number(days[1]) - 1) : null;
        drafts.push({ ...empty, url: link[1], title: decodeEntities(title[1]).trim(), image: /<img[^>]+src="([^"]+)"/.exec(card)?.[1] ?? null,
                      duration_days: days ? Number(days[1]) : null,
                      departures: [{ start, end, price: Number(price[1].replace(/,/g, "")), seats_total: null, seats_left: seats ? Number(seats[1]) : null }] });
      }
      return drafts;
    },
  },

  "when-in-city": {
    discover: async () => ["https://whenincity.com/trip-lists/"],
    read(_url, html) {
      const links = [...html.matchAll(/<a[^>]+href="(https:\/\/whenincity\.com\/[a-z0-9-]+\/)"[^>]*>(?:\s|<[^>]+>)*VIEW TRIP/gi)].map((m) => m[1]);
      const drafts: Draft[] = [];
      visibleText(html).split(/VIEW TRIP/i).forEach((chunk, i) => {
        // "Bali & Gili Islands 9 days trip 60k onwards Oct 16-24 | Oct 24-Nov 1 | ..."
        const m = /(?:.*#WICSquaD\s+)?(.+?)\s+(\d{1,2}) days trip\s+(\d+)k onwards\s+(.+)$/i.exec(chunk.trim());
        if (!m || !links[i]) return;
        const days = Number(m[2]);
        const starts = m[4].split("|").map((d) => /([A-Za-z]{3,})\s+(\d{1,2})\s*-/.exec(d)).map((d) => (d ? nextDate(Number(d[2]), d[1]) : null)).filter((d): d is string => d !== null);
        drafts.push({ ...empty, url: links[i], title: `${m[1].trim()} Group Trip`, image: null, duration_days: days,
                      // the site gives a rounded "from" price in thousands
                      departures: starts.map((start) => ({ start, end: addDays(start, days - 1), price: Number(m[3]) * 1000, seats_total: null, seats_left: null })) });
      });
      return drafts;
    },
  },

  "veena-world": {
    discover: async () => (await sitemapUrls("https://www.veenaworld.com/tour-package-sitemap.xml")).filter((u) => /\/package\/[a-z0-9-]+$/.test(u)),
    read(_url, html) {
      // each package page carries its own tour and a few related ones, all with their departures
      return objectsWithKey(html, "departureDates").filter((t) => typeof t.productUrl === "string" && typeof t.title === "string" && Array.isArray(t.departureDates)).map((t) => ({
        ...empty, url: new URL(t.productUrl as string, "https://www.veenaworld.com").href, title: String(t.title), image: typeof t.image === "string" ? t.image : null,
        duration_days: num(t.days), location: [t.sectorName, t.title].filter((x) => typeof x === "string").join(" "),
        departures: (t.departureDates as Record<string, unknown>[]).filter((d) => d.vacancyStatus === "Open" && d.jlAvailable).map((d) => {
          // the "joining & leaving" price: the tour without flights from India, which is how every other trip here is priced
          const jl = ((d.jlPrice ?? d.price ?? []) as Record<string, unknown>[]).map((p) => num(p.jLINRPrice) ?? 0).filter((p) => p > 0);
          return { start: iso(d.departureDate)!, end: iso(d.arrivalDate), price: jl.length ? Math.min(...jl) : 0, seats_total: null, seats_left: num(d.totalAvailableSeats) };
        }),
      }));
    },
  },

  "himalayan-dream-treks": {
    discover: async () => (await sitemapUrls("https://himalayandreamtreks.in/trek-sitemap.xml")).filter((u) => /\/trek\/[a-z0-9-]+\/?$/.test(u)),
    read(url, html) {
      const trip = jsonLd(html).find((o) => o["@type"] === "TouristTrip");
      const price = num((trip?.offers as Record<string, unknown> | undefined)?.price);
      const text = visibleText(html);
      // "October 10, 2026 Booking Open"
      const dates = [...text.matchAll(/([A-Z][a-z]+) (\d{1,2}), (\d{4})\s+Booking Open/g)].map((d) => nextDate(Number(d[2]), d[1], Number(d[3]))).filter((d): d is string => d !== null);
      const days = /(\d{1,2})\s*Days/.exec(text) ?? /(\d{1,2})\s*D\s*\/\s*\d{1,2}\s*N/.exec(text);
      if (!trip || !price || !dates.length || !days) return null;
      return { ...empty, url, title: String(trip.name), image: meta(html, "og:image"), duration_days: Number(days[1]),
               gst_included: /\+\s*5%\s*GST/i.test(text) ? false : null,
               departures: dates.map((start) => ({ start, end: addDays(start, Number(days[1]) - 1), price, seats_total: null, seats_left: null })) };
    },
  },

  "firgun-travels": {
    discover: async () => (await sitemapUrls("https://firguntravels.com/sitemap.xml")).filter((u) => /\/upcoming-trips\/[a-z0-9-]+$/.test(u)),
    read(url, html) {
      // "... Get Full itinerary Bir Billing 4th to 6th December Rs. 14,999 ..."
      const m = /Get Full itinerary\s+(.+?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:([A-Za-z]{3,})\s*)?(?:to|-|–)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+Rs\.?\s*([\d,]+)/.exec(visibleText(html));
      if (!m) return null;
      const start = nextDate(Number(m[2]), m[3] ?? m[5]);
      if (!start) return null;
      let end = nextDate(Number(m[4]), m[5], Number(start.slice(0, 4)));
      if (end && end < start) end = nextDate(Number(m[4]), m[5], Number(start.slice(0, 4)) + 1);
      return { ...empty, url, title: m[1].trim(), image: meta(html, "og:image"), duration_days: end ? daysBetween(start, end) + 1 : null,
               departures: [{ start, end, price: Number(m[6].replace(/,/g, "")), seats_total: null, seats_left: null }] };
    },
  },

  "wander-womaniya": {
    womenOnly: true,
    discover: async () => linkedUrls("https://www.wanderwomaniya.com/", /^\/solo-female-trip\/[a-z0-9-]+$/),
    read(url, html) {
      const product = jsonLd(html).find((o) => o["@type"] === "Product");
      const price = num((product?.offers as Record<string, unknown> | undefined)?.price);
      const desc = meta(html, "og:description") ?? "";
      // "(21 - 25 October 2026)" or "(28 October - 2 November 2026)"
      const d = /\((\d{1,2})(?:\s+([A-Za-z]+))?\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\)/.exec(desc);
      const title = (meta(html, "og:title") ?? "").split("|")[0].replace(/\s+\d{2}$/, "").trim();
      if (!price || !d || !title) return null;
      const end = nextDate(Number(d[3]), d[4], Number(d[5]));
      let start = nextDate(Number(d[1]), d[2] ?? d[4], Number(d[5]));
      if (start && end && start > end) start = nextDate(Number(d[1]), d[2] ?? d[4], Number(d[5]) - 1);
      if (!start || !end) return null;
      return { url, title, image: meta(html, "og:image"), duration_days: daysBetween(start, end) + 1, location: null, meeting_point: null, end_point: null,
               inclusions: [], exclusions: [], gst_included: null, departures: [{ start, end, price, seats_total: null, seats_left: null }] };
    },
  },
};

/** Whether the operator's own lists say GST is included, excluded, or don't say. */
function gstFrom(inclusions: string[], exclusions: string[]): boolean | null {
  const mentions = (list: string[]) => list.some((s) => /\bGST\b|goods and services tax/i.test(s));
  if (mentions(exclusions)) return false;
  if (mentions(inclusions)) return true;
  return null;
}

const WOMEN_ONLY = /\b(all[- ]girls|girls[- ]only|women[- ]only|females?[- ]only|ladies[- ]only|for women|women'?s special)\b/i;

// ---------- run ----------
async function importOperator(id: string, src: Source) {
  const report = { operator_id: id, pages_read: 0, pages_ok: 0, trips: 0, departures: 0, skipped_no_destination: [] as string[], note: "" };
  const trips: ImportedTrip[] = [];
  const taken = new Set<string>();
  let urls: string[] = [];
  try {
    urls = [...new Set(await src.discover())];
  } catch (e) {
    report.note = `could not list trips: ${e instanceof Error ? e.message : e}`;
  }
  if (!urls.length && !report.note) report.note = "no trip pages found";
  for (const url of urls) {
    if (trips.length >= MAX_TRIPS || report.pages_read >= MAX_PAGES) break;
    const html = await fetchText(url);
    report.pages_read++;
    if (!html) continue;
    report.pages_ok++;
    let found: Draft[] = [];
    try {
      const read = src.read(url, html);
      found = read ? (Array.isArray(read) ? read : [read]) : [];
    } catch {
      found = [];
    }
    for (const draft of found) {
    if (trips.length >= MAX_TRIPS || taken.has(draft.url) || !draft.title) continue;
    taken.add(draft.url);
    // a "capacity" of one or two is a placeholder on some sites, not a real group size
    for (const d of draft.departures) if (d.seats_total !== null && d.seats_total < 4) d.seats_total = d.seats_left = null;
    const seen = new Set<string>();
    const departures = draft.departures
      .filter((d) => d.start && d.start >= TODAY && d.start <= HORIZON && d.price >= 500 && !seen.has(d.start) && seen.add(d.start))
      .sort((a, b) => a.start.localeCompare(b.start)).slice(0, MAX_DEPARTURES);
    if (!departures.length) continue;
    const dest = matchDestination(draft.title, draft.location, slugOf(url).replace(/-/g, " "));
    if (!dest) {
      report.skipped_no_destination.push(draft.title);
      continue;
    }
    draft.title = decodeEntities(decodeEntities(draft.title)).replace(/\s+/g, " ").trim();
    if (!draft.duration_days && draft.departures[0]?.end) draft.duration_days = daysBetween(draft.departures[0].start, draft.departures[0].end) + 1;
    // shouted titles are easier to read in title case; the words are unchanged
    if (draft.title === draft.title.toUpperCase()) draft.title = draft.title.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase()).replace(/\b(\d+)(n|d)\b/gi, (_, n, u) => n + u.toUpperCase());
    trips.push({ ...draft, operator_id: id, destination_slug: dest.slug, women_only: Boolean(draft.women_only || src.womenOnly || WOMEN_ONLY.test(draft.title)), departures });
    }
  }
  report.trips = trips.length;
  report.departures = trips.reduce((n, t) => n + t.departures.length, 0);
  console.log(`${id.padEnd(18)} pages ${String(report.pages_read).padStart(2)}  trips ${String(report.trips).padStart(2)}  departures ${String(report.departures).padStart(3)}  ${report.note}`);
  return { trips, report };
}

export interface ImportResult {
  written: boolean;
  fetched_at: string;
  trips: number;
  departures: number;
  operators: number;
  new_trips: string[];
  removed_trips: number;
  note: string;
}

interface ImportFile {
  fetched_at: string;
  trips: ImportedTrip[];
}

/**
 * Reads every supported operator's site and rewrites data/trips.json.
 * - An operator whose site could not be reached keeps the trips from the previous run (minus departures now in the past).
 * - If the run comes back with far fewer trips than before (network down, say), the previous file is left untouched.
 */
export async function runImport(): Promise<ImportResult> {
  resetClock();
  const file = path.join(ROOT, "data", "trips.json");
  let previous: ImportFile | null = null;
  try {
    previous = JSON.parse(await readFile(file, "utf8"));
  } catch {
    previous = null;
  }
  const now = new Date().toISOString();
  // operators are independent sites, so they run side by side; each one is still read one page at a time
  const results = await Promise.all(Object.keys(SOURCES).map((id) => importOperator(id, SOURCES[id])));
  for (const r of results) {
    for (const t of r.trips) t.fetched_at = now;
    if (r.report.pages_ok > 0 || !previous) continue;
    const kept = previous.trips.filter((t) => t.operator_id === r.report.operator_id)
      .map((t) => ({ ...t, fetched_at: t.fetched_at ?? previous!.fetched_at, departures: t.departures.filter((d) => d.start >= TODAY) }))
      .filter((t) => t.departures.length);
    if (kept.length) {
      r.trips = kept;
      r.report.note = `site unreachable; kept ${kept.length} trips from the previous run`;
    }
  }
  const trips = results.flatMap((r) => r.trips);
  const before = new Set((previous?.trips ?? []).map((t) => t.url));
  const after = new Set(trips.map((t) => t.url));
  const result: ImportResult = {
    written: false, fetched_at: now, trips: trips.length, departures: trips.reduce((n, t) => n + t.departures.length, 0),
    operators: results.filter((r) => r.trips.length).length,
    new_trips: previous ? trips.filter((t) => !before.has(t.url)).map((t) => `${t.title} (${t.operator_id})`) : [],
    removed_trips: previous ? [...before].filter((u) => !after.has(u)).length : 0, note: "",
  };
  if (previous && trips.length < previous.trips.length * 0.4) {
    result.note = `only ${trips.length} trips came back against ${previous.trips.length} before, so the previous data was kept`;
    return result;
  }
  await mkdir(path.join(ROOT, "data"), { recursive: true });
  await writeFile(file, JSON.stringify({ fetched_at: now, trips, report: results.map((r) => r.report), changes: { new_trips: result.new_trips, removed_trips: result.removed_trips } }, null, 1));
  result.written = true;
  return result;
}

async function main() {
  const only = process.argv.slice(2);
  if (only.length) {
    // trial run for named operators: print what was read, write nothing
    const results = await Promise.all(only.filter((id) => SOURCES[id]).map((id) => importOperator(id, SOURCES[id])));
    console.log(JSON.stringify(results.flatMap((r) => r.trips).slice(0, 2), null, 1).slice(0, 3000));
    return;
  }
  const r = await runImport();
  console.log(r.written
    ? `\nWrote data/trips.json: ${r.trips} trips, ${r.departures} departures from ${r.operators} operators (${r.new_trips.length} new trips, ${r.removed_trips} no longer listed)`
    : `\nNothing written: ${r.note}`);
}

// run only when started directly (`yarn import:trips`), not when the server imports this file
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

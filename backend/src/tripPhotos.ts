// Choosing each trip's photo. An operator's page doesn't always say which picture is the trip's: some sites give every
// page the same og:image (their logo, or one group photo), some have none, and some photos have since been deleted.
// So after an operator's trips are read, any trip whose photo is missing, a logo, broken, or shared with another of
// that operator's trips gets the first photo that its own page shows and none of the operator's other trip pages do.
import { imageUrl } from "./utils.js";

/** Pictures that are never a trip's photo: logos, icons, people's faces in reviews, maps and itinerary graphics. */
/** (tested on the file's name, so a host like logout.world or a folder like /itinerary/ doesn't count) */
const NOT_A_PHOTO = /logo|icon|favicon|avatar|sprite|placeholder|badge|flag|payment|gpay|qr[-_]?code|loader|spinner|testimon|review|rating|tripadvisor|certificate|award|illustration|(?:^|[-_.])map(?:[-_.]|$)|\.svg$|\.gif$/i;
/** folders that hold drawings and people's pictures, not trip photos (Capture a Trip's illustration_web/, testimony/) */
const NOT_A_PHOTO_DIR = /illustration|testimon|review|avatar|\/team\/|author|profile/i;
/** hosts whose pictures are never a trip's own photo: video stills with black bars, social sites' profile pictures */
const NOT_A_PHOTO_HOST = /(?:^|\.)(?:ytimg\.com|youtube\.com|gravatar\.com|fbcdn\.net|cdninstagram\.com|googleusercontent\.com|gstatic\.com|w3\.org)$/i;
/** WordPress's small resized copies ("photo-150x150.jpg") */
const SMALL_COPY = /-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|avif)/i;
const PHOTO_FILE = /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i;

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/\\u002F/gi, "/").replace(/\\\//g, "/");

export function looksLikeLogo(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    return NOT_A_PHOTO_HOST.test(u.hostname) || NOT_A_PHOTO_DIR.test(u.pathname) || NOT_A_PHOTO.test(decodeURIComponent(u.pathname.split("/").pop() ?? ""));
  } catch {
    return true;
  }
}

/**
 * The photos a trip page shows, best guess first: its structured data's image, its og:/twitter: image, images it
 * preloads, then its <img> tags and background images in page order, then any photo URL in its scripts' data. Logos,
 * icons, maps and small thumbnails are left out. URLs are made absolute against `page`.
 */
export function pagePhotos(html: string, page: string): string[] {
  const found: string[] = [];
  const add = (raw: string | undefined | null) => {
    if (!raw) return;
    let src = decode(raw.trim());
    // Next.js serves its photos through /_next/image?url=<the real photo>
    const next = /\/_next\/image\/?\?url=([^&]+)/.exec(src);
    if (next) src = decodeURIComponent(next[1]);
    const small = SMALL_COPY.exec(src);
    if (small && Math.max(Number(small[1]), Number(small[2])) < 500) return;
    const abs = imageUrl(src, page);
    if (!abs || looksLikeLogo(abs)) return;
    if (PHOTO_FILE.test(new URL(abs).pathname + "#")) found.push(abs);
    else if (/framerusercontent|wixstatic|cloudinary|imagekit|unsplash|cdn/i.test(abs)) found.push(abs);
  };
  const largest = (srcset: string) => srcset.split(/,\s+/).map((c) => c.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] ?? "0") - parseFloat(a[1] ?? "0"))[0]?.[0];

  // structured data
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const im of m[1].matchAll(/"image"\s*:\s*(\[[^\]]*\]|"[^"]+"|\{[^}]*\})/g)) {
      for (const u of im[1].matchAll(/"(https?:[^"]+)"/g)) add(u[1]);
    }
  }
  for (const prop of ["og:image", "og:image:secure_url", "twitter:image"]) {
    for (const m of html.matchAll(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]*>`, "gi"))) add(/content="([^"]+)"/.exec(m[0])?.[1]);
  }
  for (const m of html.matchAll(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/gi)) {
    const set = /imagesrcset="([^"]+)"/i.exec(m[0])?.[1];
    add(set ? largest(decode(set)) : /href="([^"]+)"/.exec(m[0])?.[1]);
  }
  for (const m of html.matchAll(/<img\b[^>]*>|style="[^"]*url\([^)]+\)[^"]*"/gi)) {
    const tag = m[0];
    if (tag.startsWith("style")) {
      add(/url\(['"]?([^'")]+)/.exec(tag)?.[1]);
      continue;
    }
    // a small fixed-size image is an icon or a thumbnail
    const w = Number(/\bwidth="(\d+)"/.exec(tag)?.[1] ?? 0);
    if (w && w < 300) continue;
    const set = /\b(?:data-srcset|srcset|data-lazy-srcset)="([^"]+)"/i.exec(tag)?.[1];
    add(/\b(?:data-src|data-lazy-src|data-original)="([^"]+)"/i.exec(tag)?.[1] ?? (set ? largest(decode(set)) : /\bsrc="([^"]+)"/i.exec(tag)?.[1]));
  }
  // photos named in the page's data (Wix, Framer and Next.js pages keep their galleries there)
  for (const m of decode(html).matchAll(/https?:\/\/[^"'\s\\)<>]+?\.(?:jpe?g|png|webp|avif)/gi)) add(m[0]);
  // photos before PNGs: a PNG on these sites is mostly a poster with words on it, a collage or a graphic
  const unique = [...new Set(found)];
  const png = (u: string) => /\.png(?:[?#]|$)/i.test(new URL(u).pathname);
  return [...unique.filter((u) => !png(u)), ...unique.filter(png)];
}

/**
 * Whether a URL serves a real photo: false for an error page, a deleted file, a site that refuses other sites or a
 * tiny icon; null when the server couldn't be reached in time (which says nothing about the photo).
 */
export async function photoLoads(src: string): Promise<boolean | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await askForPhoto(src);
    if (answer !== null) return answer;
  }
  return null;
}

async function askForPhoto(src: string): Promise<boolean | null> {
  try {
    const r = await fetch(src, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", Range: "bytes=0-2047",
        // as a browser showing it on our page would ask
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: "https://get-packd.vercel.app/" },
      redirect: "follow", signal: AbortSignal.timeout(20_000),
    });
    await r.body?.cancel();
    if (r.status >= 500 || r.status === 429) return null;
    if (!r.ok) return false;
    const type = r.headers.get("content-type") ?? "";
    if (!/^image\/|octet-stream/.test(type)) return false;
    // a few KB is an icon, not a photo
    const total = Number(/\/(\d+)$/.exec(r.headers.get("content-range") ?? "")?.[1] ?? r.headers.get("content-length") ?? 0);
    return !total || total > 12_000;
  } catch {
    return null;
  }
}

interface PhotoTrip {
  url: string;
  image: string | null;
  destination_slug: string;
}

/**
 * Gives each of one operator's trips a photo of its own, where its page has one. A trip is looked at again when its
 * photo is missing, a logo, doesn't load, or is shared with another of the operator's trips. It then takes the first
 * photo its page shows that no other trip page of the operator shows (a site-wide banner or logo is on every page, a
 * trip's own photos only on its page). When there is none, a shared photo is kept if every trip using it goes to the
 * same place (two dates of one trip), and dropped otherwise, so the site shows the destination's photo instead of
 * one from somewhere else.
 */
export async function settlePhotos<T extends PhotoTrip>(trips: T[], pageOf: (url: string) => Promise<string | null>, loads: (src: string) => Promise<boolean | null> = photoLoads): Promise<number> {
  const checked = new Map<string, Promise<boolean | null>>();
  const ok = (src: string) => {
    if (!checked.has(src)) checked.set(src, loads(src));
    return checked.get(src)!;
  };
  const users = new Map<string, T[]>();
  for (const t of trips) if (t.image) users.set(t.image, [...(users.get(t.image) ?? []), t]);
  const suspect: T[] = [];
  for (const t of trips) {
    if (!t.image || looksLikeLogo(t.image) || (await ok(t.image)) === false) suspect.push(t);
    else {
      // two dates or editions of one trip ("Trip to Udaipur", "Trip to Udaipur XMAS & NY Special") may share its photo;
      // a photo used for different places, or by three or more trips, is the site's, not a trip's
      const sharers = users.get(t.image)!;
      if (sharers.length > 2 || sharers.some((s) => s.destination_slug !== t.destination_slug)) suspect.push(t);
    }
  }
  if (!suspect.length) return 0;

  // the photos on every trip page of this operator, and how many of those pages show each one
  const shown = new Map<string, string[]>();
  for (const t of trips) {
    if (shown.has(t.url)) continue;
    const html = await pageOf(t.url);
    shown.set(t.url, html ? pagePhotos(html, t.url) : []);
  }
  const pagesShowing = new Map<string, number>();
  for (const list of shown.values()) for (const src of list) pagesShowing.set(src, (pagesShowing.get(src) ?? 0) + 1);

  const taken = new Set(trips.filter((t) => !suspect.includes(t)).map((t) => t.image));
  let changed = 0;
  for (const t of suspect) {
    let pick: string | null = null;
    for (const src of shown.get(t.url) ?? []) {
      if (pagesShowing.get(src) !== 1 || taken.has(src)) continue;
      if ((await ok(src)) === true) {
        pick = src;
        break;
      }
    }
    const before = t.image;
    if (pick) t.image = pick;
    else if (t.image) {
      const sharers = users.get(t.image)!;
      const samePlace = sharers.every((s) => s.destination_slug === t.destination_slug);
      if (looksLikeLogo(t.image) || !samePlace || (await ok(t.image)) === false) t.image = null;
    }
    if (t.image) taken.add(t.image);
    if (t.image !== before) changed++;
  }
  return changed;
}

/**
 * Operators' banners: a photo with the trip's name or a slogan printed across it ("Winter Spiti", "VIETNAM ESCAPE").
 * On a card the words are cut off and fight the title under it. Each was found by eye (and macOS text recognition)
 * on 2026-11-25 and is swapped for a photo of the same trip, from its own page, with no words on it; null means the
 * page had none, so the site shows the destination's photo. Keyed by the banner's address, so an entry simply stops
 * matching if the operator changes the banner.
 */
export const POSTER_PHOTOS: Record<string, string | null> = {
  // justwravel · Andaman: a white-sand beach
  "https://static.justwravel.com/images/cgnfe1hd/production/4d9f49cd2056f93b450ea90e93374aedf5e6ab51-1200x630.jpg?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/35889b717681e9c8a78f0305ab20978159ca631b-950x600.jpg?auto=format",
  // justwravel · Tawang: the group in the snow at Bum La
  "https://static.justwravel.com/images/cgnfe1hd/production/5fa0b5895baaebd7075591c37969c24368e82388-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/4c0f12cfbcfaece5eef7b8750faee7251839c49a-950x600.jpg?auto=format",
  // justwravel · Himachal Explorer: the group below the mountains
  "https://static.justwravel.com/images/cgnfe1hd/production/6d7ce5729910282e9374f7ee5c15185475d691e8-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/3ffe709615c9008a3ad5b9831914a685772bbb7d-950x600.jpg?auto=format",
  // justwravel · Mcleodganj-Triund-Bir: paragliding over the valley
  "https://static.justwravel.com/images/cgnfe1hd/production/cfea5bd838997aceca829ed8bdbbf23d9410d2d6-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/b7dffba298e237694a9dfbe12fdf9c577bdbd06d-950x600.jpg?auto=format",
  // justwravel · All-girls Manali-Kasol-Jibhi: the group in the snow
  "https://static.justwravel.com/images/cgnfe1hd/production/1e70b721e858117e7efa5e879e271e0ee6f2e86e-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/250bb780c63627310c6c8b3b212c688e9fe03bf4-950x600.jpg?auto=format",
  // justwravel · Manali-Kasol-Jibhi: the group at a waterfall
  "https://static.justwravel.com/images/cgnfe1hd/production/bc73bed2dd315c68854fe769dfd1aeb04ffab5a6-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/bab18f1362e99f4e0e85860f7e06c85b97d3c728-950x600.jpg?auto=format",
  // justwravel · Winter Spiti: Key Monastery in snow
  "https://static.justwravel.com/images/cgnfe1hd/production/7bc3a7ecb08b65d70322015b26adfe71475f7d00-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/798eff0ef605c4f4c5e2e660b6b30203de8b897b-1270x800.jpg",
  // justwravel · Spiti 4x4: the car in the snow
  "https://static.justwravel.com/images/cgnfe1hd/production/6032c9991bcce423a76ac96db8a1e100b9086c2a-1366x684.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/bb4aea69f7591d0889472381ff2a61bc8e339d33-1946x1297.jpg?auto=format",
  // justwravel · Winter Kashmir: the same shikara, without the words
  "https://static.justwravel.com/images/cgnfe1hd/production/aee59a0dcef35e96616a21066d02bbf7cb1702a8-1708x855.webp?auto=format":
    "https://static.justwravel.com/images/cgnfe1hd/production/177532ca8e15a9a10b1bedb519e138e42d71bd32-1055x455.webp",
  // hikerwolf · Coorg: feeding an elephant
  "https://hikerwolf.com/wp-content/uploads/2022/09/Coorg-The-Scotland-of-India.jpg":
    "https://hikerwolf.com/wp-content/uploads/2026/09/773845148515142997.jpg",
  // hikerwolf · Dandeli-Gokarna: river rafting
  "https://hikerwolf.com/wp-content/uploads/2026/09/224c20f5-c910-4bce-983f-46f20d507cc9.png":
    "https://hikerwolf.com/wp-content/uploads/2026/09/River-Rafting-in-Dandeli-_-water-Rafting-_-Kali-River-_-Water-Sports-_-Trip-to-Dandeli-YouTube.jpg",
  // metanoia-expeditions · Vietnam with Sapa: the Sapa train in the pines, without the words
  "https://static.wixstatic.com/media/ddbd33_336c8ca53a55426abf26e846d1961944~mv2.jpg/v1/fill/w_1640,h_924,al_c/ddbd33_336c8ca53a55426abf26e846d1961944~mv2.jpg":
    "https://static.wixstatic.com/media/ddbd33_6f19488f238f47e294e0aa6325d9c3b9~mv2.jpg/v1/fill/w_1200,h_1200,al_c,q_85/ddbd33_6f19488f238f47e294e0aa6325d9c3b9~mv2.jpg",
  // metanoia-expeditions · Vietnam Escape: on a basket boat
  "https://static.wixstatic.com/media/ddbd33_f09ca34c7fe2415a8050b62d552fb2e4~mv2.jpg/v1/fill/w_1640,h_924,al_c/ddbd33_f09ca34c7fe2415a8050b62d552fb2e4~mv2.jpg":
    "https://static.wixstatic.com/media/ddbd33_769928dfd040448db6e03a1ed8af987e~mv2.png/v1/fill/w_1200,h_1200,al_c,q_85/ddbd33_769928dfd040448db6e03a1ed8af987e~mv2.jpg",
  // when-in-city · Thai Crawl: the page's other photos are polaroid graphics → the destination's photo
  "https://whenincity.com/wp-content/uploads/2025/11/2.png":
    null,
};

/** Swaps any of the trips' banners for the photo chosen in POSTER_PHOTOS. Returns how many trips changed. */
export function replacePosters<T extends { image: string | null }>(trips: T[]): number {
  let changed = 0;
  for (const t of trips) {
    if (t.image && t.image in POSTER_PHOTOS) {
      t.image = POSTER_PHOTOS[t.image];
      changed++;
    }
  }
  return changed;
}

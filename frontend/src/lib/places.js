// Places that two or more compared trips both name in their day headings, and the day(s) each trip is there.
// Only the operators' own words are used: a place counts when its name (a run of capitalised words in one trip's day
// heading, like "Annapurna Base Camp") appears as whole words in another trip's day headings. Nothing is guessed, so
// "ABC" and "Annapurna Base Camp" are not matched to each other.

// words that say what happens, not where: a phrase made only of these is never a place
const GENERIC = new Set(`day days trek treks trekking hike hiking drive driving road trip tour arrive arrival arrivals reach depart departure
  return back journey overnight morning evening night transfer sightseeing local explore exploration excursion visit rest acclimatization
  acclimatisation acclimatize leisure free check in out base camp camps lake lakes valley pass top peak summit village city town temple
  monastery fort palace beach market station airport railway bus train flight via to from and the of at with en route kms km hrs end ends
  tour ends trip ends start begins welcome goodbye home group briefing orientation optional fly flight boat cruise walk walking ride safari
  breakfast lunch dinner stay hotel homestay camping camp sunrise sunset view point viewpoint river hot spring springs waterfall falls
  final last first next same new old upper lower high higher low lower big small great grand holy sacred famous historic historical scenic
  winter summer spring autumn monsoon snow ice adventure activities activity leisurely`.split(/\s+/).filter(Boolean));
// small words that may sit inside a place name ("Valley of Flowers", "Statue of Unity"), never at its ends
const INNER = new Set(["of", "the", "de", "la", "du"]);
// words that always end a run of capitals ("Delhi To Manali" is two places)
const BREAK = new Set(["to", "from", "via", "and", "at", "in", "for", "with", "towards", "toward", "till", "until", "then", "or", "on", "by", "into", "onto", "vs"]);

export const norm = (s) => ` ${String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

// every run of capitalised words in a heading, and each shorter run inside it
function candidates(title) {
  // punctuation always separates places ("Chitkul/Sangla", "Langza - Komic - Hikkim"); only spaces join a name's words
  const words = [];
  for (const seg of String(title).split(/[/|,;:()[\]{}"“”‘’!?.&+>→–—-]+/)) words.push(...seg.split(/\s+/).filter(Boolean), "|");
  const runs = [];
  let cur = [];
  const close = () => { while (cur.length && INNER.has(cur.at(-1).toLowerCase())) cur.pop(); if (cur.length) runs.push(cur); cur = []; };
  for (const w of words) {
    const lw = w.toLowerCase();
    if (w === "|" || BREAK.has(lw) || /^\d/.test(w)) { close(); continue; }
    if (/^[A-Z]/.test(w)) cur.push(w);
    else if (INNER.has(lw) && cur.length) cur.push(w);
    else close();
  }
  close();
  const out = new Set();
  for (const r of runs) {
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j <= r.length; j++) {
        const part = r.slice(i, j);
        if (INNER.has(part[0].toLowerCase()) || INNER.has(part.at(-1).toLowerCase())) continue;
        const lw = part.map((w) => w.toLowerCase());
        if (lw.every((w) => GENERIC.has(w) || INNER.has(w))) continue;
        if (part.length === 1 && part[0].length < 4) continue;
        out.add(norm(part.join(" ")));
      }
    }
  }
  return out;
}

/**
 * @param {Array<Array<{day:number,title:string}>>} trips each trip's days (already titled)
 * @returns {{ name: string, key: string, days: number[][] }[]} shared places in trip order, each with the days per trip
 */
export function sharedPlaces(trips) {
  const heads = trips.map((days) => (days || []).map((d) => ({ day: d.day, text: norm(d.title || "") })));
  const all = new Map(); // key → display name (as first written)
  trips.forEach((days) => (days || []).forEach((d) => {
    for (const key of candidates(d.title || "")) if (!all.has(key)) all.set(key, null);
  }));
  // a display name: the first heading's own spelling of it
  const nameOf = (key) => {
    for (const days of trips) for (const d of days || []) {
      const words = String(d.title || "").split(/\s+/);
      for (let i = 0; i < words.length; i++) for (let j = i + 1; j <= words.length; j++) {
        const s = words.slice(i, j).join(" ").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
        if (norm(s) === key) return s;
      }
    }
    return key.trim();
  };
  const found = [];
  for (const key of all.keys()) {
    const days = heads.map((h) => h.filter((d) => d.text.includes(key)).map((d) => d.day));
    if (days.filter((x) => x.length).length >= 2) found.push({ key, days });
  }
  // the longest name wins: "Annapurna Base Camp" hides "Annapurna" when it is the same days in every trip
  found.sort((a, b) => b.key.length - a.key.length);
  const kept = [];
  for (const f of found) {
    const inside = kept.find((k) => k.key.includes(f.key) && k.days.every((d, i) => d.join() === f.days[i].join()));
    if (!inside) kept.push(f);
  }
  const first = (f) => Math.min(...f.days.flat());
  return kept.sort((a, b) => first(a) - first(b) || b.days.filter((d) => d.length).length - a.days.filter((d) => d.length).length)
    .map((f) => ({ ...f, name: nameOf(f.key) }));
}

/** "Day 4", "Days 4–5", "Days 1, 9" */
export function dayList(days) {
  if (!days.length) return "";
  const parts = [];
  for (let i = 0; i < days.length; i++) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
    parts.push(j > i ? `${days[i]}–${days[j]}` : `${days[i]}`);
    i = j;
  }
  return `${days.length > 1 ? "Days" : "Day"} ${parts.join(", ")}`;
}

/** splits a heading into pieces, marking the shared places in it: [{ text, key? }] */
export function markPlaces(title, keys) {
  const t = String(title);
  const hits = [];
  for (const key of keys) {
    const words = key.trim().split(" ");
    // the place's words in order, with any punctuation or spacing between them, as whole words
    const re = new RegExp(`(?<![A-Za-z0-9])${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^A-Za-z0-9]+")}(?![A-Za-z0-9])`, "gi");
    for (const m of t.matchAll(re)) hits.push({ start: m.index, end: m.index + m[0].length, key });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let at = 0;
  for (const h of hits) {
    if (h.start < at) continue; // inside a longer place already marked
    if (h.start > at) out.push({ text: t.slice(at, h.start) });
    out.push({ text: t.slice(h.start, h.end), key: h.key });
    at = h.end;
  }
  if (at < t.length) out.push({ text: t.slice(at) });
  return out;
}

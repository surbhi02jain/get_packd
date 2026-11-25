// The group size a trip page states in words ("Group Size: Limited to 18 travelers", "12–14 Group Size",
// "small groups of maximum 12 people"). Booking systems also carry a seat count per date (slots, capacity,
// max guests), but that is how many bookings a date takes, often 25-40, and not a group size the operator
// promises, so only the page's own words count. Reviews ("we were a group of 12"), hedged answers
// ("group size is usually around 15 - 20") and averages ("Group Size 20 people avg.") are not read as one.

export interface GroupSize {
  min: number | null;
  max: number;
}

const N = String.raw`(\d{1,2})`;
const RANGE = String.raw`${N}(?:\s*(?:-|–|—|to)\s*${N})?`;
const PATTERNS = [
  // "Group Size: Limited to 18 travelers", "Group Size Max 20", "Group Size - 12 to 25", "Group Size 12 max"
  new RegExp(String.raw`\bgroup size\b\s*[:\-–]?\s*(?:(?:is\s+)?(?:max(?:imum)?\.?|limited to|up\s*to|upto|of)\s*)?${RANGE}(?!\s*(?:%|days?|nights?|yrs|years|km|ft|feet|am|pm)\b)(?!\s*(?:people|persons|pax|travell?ers|guests)?\s*(?:avg|average|approx|on average)\b)`, "i"),
  // "12–14 Group Size" (a fact strip with the label under the figure)
  new RegExp(String.raw`(?<![\d,.₹])${N}\s*(?:-|–|—|to)\s*${N}\s*group size\b`, "i"),
  // "small groups of maximum 12 people", "groups of up to 15 travellers"
  new RegExp(String.raw`\bgroups? of (?:max(?:imum)?\.?|up\s*to|upto|not more than)\s*${N}\s*(?:people|persons|travell?ers|pax|members|guests)\b`, "i"),
];

export function statedGroupSize(text: string): GroupSize | null {
  let best: { at: number; size: GroupSize } | null = null;
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : null;
    const size = b === null ? { min: null, max: a } : { min: Math.min(a, b), max: Math.max(a, b) };
    if (size.max < 2 || size.max > 60 || (size.min !== null && size.min < 1)) continue;
    // the first one on the page is the trip's fact; later ones are often FAQs or site-wide blurbs
    if (!best || m.index < best.at) best = { at: m.index, size };
  }
  return best?.size ?? null;
}

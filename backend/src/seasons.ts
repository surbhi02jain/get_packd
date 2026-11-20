// When to go, and practical tips, per destination. Hand-drafted for the destinations that have trips; months are 1-12.
//   best:    the months most travellers would pick for this place
//   off:     months with a real drawback (monsoon landslides, closed passes, extreme heat), with `off_why` saying which
//   other months are fine, just not the best
// Group trips do run in off months (winter Spiti, monsoon treks); the label says what to expect, not that a trip is wrong.
// A destination missing here shows no season or tips.

export interface Season {
  best: number[];
  off: number[];
  off_why: string;
  tips: string[];
}

export const SEASONS: Record<string, Season> = {
  kashmir: { best: [4, 5, 6, 9, 10], off: [], off_why: "", tips: [
    "Prepaid SIMs from outside Jammu & Kashmir don't work there; carry a postpaid connection.",
    "Gulmarg Gondola tickets, especially Phase 2, sell out; book them online ahead.",
  ] },
  spiti: { best: [6, 7, 8, 9], off: [12, 1, 2, 3], off_why: "Deep winter, heavy snow", tips: [
    "Kaza is at about 3,800 m; take the first day easy to acclimatise.",
    "Phone signal is patchy beyond Kaza; BSNL and Jio work best.",
  ] },
  ladakh: { best: [6, 7, 8, 9], off: [11, 12, 1, 2, 3], off_why: "Winter, high passes shut", tips: [
    "Rest a full day in Leh (about 3,500 m) before going higher.",
    "Prepaid SIMs from outside Ladakh and J&K don't work; carry a postpaid connection.",
  ] },
  himachal: { best: [3, 4, 5, 6, 9, 10, 11], off: [7, 8], off_why: "Monsoon, landslides", tips: [
    "Rohtang Pass needs an online permit for vehicles and is closed on Tuesdays.",
    "Roads to Lahaul can still close after heavy snow, even with the Atal Tunnel.",
  ] },
  uttarakhand: { best: [4, 5, 6, 9, 10, 11], off: [7, 8], off_why: "Monsoon, landslides", tips: [
    "Char Dham yatris must register online before travel; operators usually do it for you.",
    "Winter treks like Kedarkantha mean sub-zero nights; carry proper boots and warm layers.",
  ] },
  kerala: { best: [10, 11, 12, 1, 2, 3], off: [6, 7], off_why: "Peak monsoon", tips: [
    "Showers are common in the Western Ghats even in winter; pack light rainwear.",
    "Houseboat and resort prices peak over Christmas and New Year; book early.",
  ] },
  karnataka: { best: [10, 11, 12, 1, 2], off: [], off_why: "", tips: [
    "Many Western Ghats treks now need an online Forest Department booking, and some close in monsoon.",
    "Hampi is hot from March to May; start sightseeing early in the morning.",
  ] },
  tamilnadu: { best: [11, 12, 1, 2, 3], off: [], off_why: "", tips: [
    "Temples expect covered shoulders and knees, and many restrict photography inside.",
    "Ooty and Kodaikanal are coolest and busiest in April to June.",
  ] },
  maharashtra: { best: [7, 8, 9, 10, 11, 12, 1, 2], off: [4, 5], off_why: "Summer heat on exposed forts", tips: [
    "Monsoon treks get slippery and crowded at weekends; wear shoes with good grip.",
    "Some forts and waterfalls close to visitors on heavy-rain alert days.",
  ] },
  goa: { best: [11, 12, 1, 2], off: [6, 7, 8], off_why: "Monsoon, many beach shacks shut", tips: [
    "Stay prices peak from Christmas to New Year; book early.",
    "Renting a scooter needs a valid two-wheeler licence.",
  ] },
  rajasthan: { best: [10, 11, 12, 1, 2, 3], off: [5, 6], off_why: "Summer heat", tips: [
    "Desert nights in December and January drop close to freezing; pack a warm layer for camps.",
    "Forts are on hills with long climbs; wear shoes you can walk in.",
  ] },
  gujarat: { best: [11, 12, 1, 2], off: [4, 5, 6], off_why: "Summer heat", tips: [
    "Rann Utsav tent stays in the white desert book out for December and January.",
  ] },
  punjab: { best: [10, 11, 2, 3], off: [5, 6], off_why: "Summer heat", tips: [
    "Cover your head and leave your shoes at the Golden Temple; the langar is open to all.",
    "Seats at the Attari-Wagah border ceremony fill up; reach about two hours early.",
  ] },
  uttarpradesh: { best: [10, 11, 12, 1, 2, 3], off: [5, 6], off_why: "Summer heat", tips: [
    "The evening Ganga aarti at Dashashwamedh Ghat is packed; arrive early or watch from a boat.",
  ] },
  madhyapradesh: { best: [10, 11, 12, 1, 2, 3], off: [4, 5, 6], off_why: "Summer heat", tips: [
    "Tiger reserve core zones close for the monsoon, roughly July to September.",
  ] },
  chhattisgarh: { best: [10, 11, 12, 1, 2], off: [4, 5], off_why: "Summer heat", tips: [] },
  andhra: { best: [11, 12, 1, 2], off: [4, 5], off_why: "Summer heat", tips: [
    "Araku Valley mornings are cold in December and January; carry a jacket.",
  ] },
  eastindia: { best: [10, 11, 12, 1, 2], off: [4, 5], off_why: "Summer heat", tips: [] },
  meghalaya: { best: [10, 11, 12, 1, 2, 3, 4], off: [6, 7], off_why: "Peak monsoon, very heavy rain", tips: [
    "The double-decker root bridge walk at Nongriat is thousands of steep steps down and back up.",
    "Shillong traffic is slow; plan Cherrapunji and Dawki as separate days.",
  ] },
  northeast: { best: [10, 11, 12, 1, 2, 3, 4], off: [6, 7, 8], off_why: "Monsoon, landslides", tips: [
    "Indians need an Inner Line Permit for Arunachal Pradesh; apply online before you go.",
  ] },
  sikkim: { best: [3, 4, 5, 10, 11, 12], off: [7, 8], off_why: "Monsoon, landslides", tips: [
    "North Sikkim (Lachung, Gurudongmar) and Nathu La need permits; operators arrange them with your ID.",
    "Nathu La is usually closed to visitors on Mondays and Tuesdays.",
  ] },
  andaman: { best: [11, 12, 1, 2, 3, 4], off: [6, 7, 8], off_why: "Monsoon, rough seas", tips: [
    "Ferries to Havelock and Neil sell out in December and January; book early.",
    "ATMs and card machines are few on Havelock and Neil; carry cash.",
  ] },
  lakshadweep: { best: [10, 11, 12, 1, 2, 3, 4], off: [6, 7, 8], off_why: "Monsoon, rough seas", tips: [
    "Indians need an entry permit; operators apply for it with your ID.",
  ] },
  nepal: { best: [3, 4, 10, 11], off: [6, 7, 8], off_why: "Monsoon, cloudy peaks", tips: [
    "Indians don't need a visa; carry a passport or voter ID.",
    "Mountain flights and roads often run late; leave a spare day before your flight home.",
  ] },
  bhutan: { best: [3, 4, 5, 10, 11], off: [6, 7, 8], off_why: "Monsoon, cloudy peaks", tips: [
    "Indians pay a Sustainable Development Fee of Nu 1,200 a night; check whether the trip price includes it.",
    "Carry a passport or voter ID; the entry permit is issued at the border.",
  ] },
  srilanka: { best: [12, 1, 2, 3], off: [], off_why: "", tips: [
    "Apply for Sri Lanka's ETA online before you fly, and check the current fee.",
    "The east coast is at its best from April to September, the opposite of the south and west.",
  ] },
  bali: { best: [4, 5, 6, 7, 8, 9, 10], off: [12, 1, 2], off_why: "Wet season, daily downpours", tips: [
    "Visa on arrival costs IDR 500,000, plus a IDR 150,000 Bali tourist levy.",
  ] },
  thailand: { best: [11, 12, 1, 2], off: [], off_why: "", tips: [
    "Thailand's visa rules for Indians have changed often; check the current rule before you fly.",
    "Temples expect covered shoulders and knees.",
  ] },
  vietnam: { best: [2, 3, 4, 10, 11], off: [], off_why: "", tips: [
    "Indians need an e-visa; apply on the official evisa.gov.vn site at least a week ahead.",
    "Hanoi and Sapa are cold in December and January; pack a jacket.",
  ] },
  cambodia: { best: [11, 12, 1, 2], off: [], off_why: "", tips: [
    "Indians can get an e-visa online before travel.",
  ] },
  singapore: { best: [], off: [], off_why: "", tips: [
    "Fill in the SG Arrival Card online in the three days before you arrive.",
  ] },
  dubai: { best: [11, 12, 1, 2, 3], off: [6, 7, 8], off_why: "Summer heat", tips: [
    "Indians with a US visa or a UK or EU residence permit can get a visa on arrival; others need one in advance.",
  ] },
  georgia: { best: [5, 6, 9, 10], off: [], off_why: "", tips: [
    "Indians with a valid US, UK or Schengen visa can enter visa-free; otherwise apply for an e-visa.",
    "The road to Kazbegi can close after heavy snow in winter.",
  ] },
  kazakhstan: { best: [5, 6, 9], off: [], off_why: "", tips: [
    "Check the current visa rules before you fly; Almaty winters drop well below freezing.",
  ] },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "best" or "off" for a departure's start month, with a short label; null when the month is unremarkable or unknown. */
export function seasonOf(slug: string, isoDate: string): { kind: "best" | "off"; label: string } | null {
  const s = SEASONS[slug];
  if (!s) return null;
  const m = Number(isoDate.slice(5, 7));
  if (s.best.includes(m)) return { kind: "best", label: "Best season" };
  if (s.off.includes(m)) return { kind: "off", label: s.off_why };
  return null;
}

/** Months as ranges for a sentence: [6,7,8,9] -> "Jun–Sep", [11,12,1,2] -> "Nov–Feb", [3,4,10,11] -> "Mar–Apr, Oct–Nov". */
export function monthRanges(months: number[]): string {
  if (!months.length) return "";
  const set = new Set(months);
  // start each run at a month whose previous month isn't in the set, so Nov–Feb wraps the new year
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  if (!starts.length) return "all year";
  return starts.map((s) => {
    let e = s;
    while (set.has(e === 12 ? 1 : e + 1) && (e === 12 ? 1 : e + 1) !== s) e = e === 12 ? 1 : e + 1;
    return e === s ? MONTHS[s - 1] : `${MONTHS[s - 1]}–${MONTHS[e - 1]}`;
  }).join(", ");
}

/** A destination's season for display, with the month lists also written as ranges. */
export function seasonInfo(slug: string | null | undefined) {
  const s = slug ? SEASONS[slug] : undefined;
  return s ? { ...s, best_text: monthRanges(s.best), off_text: monthRanges(s.off) } : null;
}

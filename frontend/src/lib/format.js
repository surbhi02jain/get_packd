import { USD_RATE } from "./constants";

// 48213 → "48.2K", 1250000 → "1.3M"
export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "")}K` : String(n));

export const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
export const short = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : n < 1000 ? `₹${Math.round(n)}` : `₹${Math.round(n / 1000)}k`);

// With "$ USD" picked in the header, every price on every page is in dollars, domestic trips too, so a page never mixes
// the two. (The third argument, whether the trip is international, no longer changes anything; callers still pass it.)
export const money = (n, currency, _intl, compact) => {
  if (currency === "usd") {
    const v = n / USD_RATE;
    return compact ? (v >= 1000 ? `$${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(v)}`) : "$" + Math.round(v).toLocaleString("en-US");
  }
  return compact ? short(n) : inr(n);
};
/** A price in the picked currency, rounded for tight spots (map pins, chips): ₹16k, $188. */
export const shortMoney = (n, currency) => money(n, currency, true, true);

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const d = (iso) => new Date(iso + "T00:00:00");
export const fmtDay = (iso) => { const x = d(iso); return `${x.getDate()} ${M[x.getMonth()]}`; };
export const fmtRange = (a, b) => {
  const x = d(a), y = d(b);
  if (a === b || !b) return fmtDay(a); // a one-day trip
  return x.getMonth() === y.getMonth() ? `${x.getDate()}–${y.getDate()} ${M[y.getMonth()]}` : `${fmtDay(a)} – ${fmtDay(b)}`;
};
export const iso = (date) => {
  const z = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
/** Today in India (where the trips leave from), as yyyy-mm-dd. */
export const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
export const monthName = (ym) => { const [y, m] = ym.split("-"); return `${M[+m - 1]} ${y.slice(2)}`; };

// Budget sliders move through these prices rather than a straight line, so ₹10k–₹20k is as easy to pick as ₹1L–₹2L.
export const PRICE_STEPS = [0, 5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 60000, 75000, 100000, 125000, 150000, 200000, 250000, 300000, 400000];
/** The index of the step closest to a price, for putting a slider handle on it. */
export const stepIndex = (steps, price) => steps.reduce((best, s, i) => (Math.abs(s - price) < Math.abs(steps[best] - price) ? i : best), 0);

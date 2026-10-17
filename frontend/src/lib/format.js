import { USD_RATE } from "./constants";

// 48213 → "48.2K", 1250000 → "1.3M"
export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "")}K` : String(n));

export const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
export const short = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : `₹${Math.round(n / 1000)}k`);

export const money = (n, currency, intl, compact) => {
  if (currency === "usd" && intl) {
    const v = n / USD_RATE;
    return compact ? `$${(v / 1000).toFixed(1)}k` : "$" + Math.round(v).toLocaleString("en-US");
  }
  return compact ? short(n) : inr(n);
};

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const d = (iso) => new Date(iso + "T00:00:00");
export const fmtDay = (iso) => { const x = d(iso); return `${x.getDate()} ${M[x.getMonth()]}`; };
export const fmtRange = (a, b) => {
  const x = d(a), y = d(b);
  return x.getMonth() === y.getMonth() ? `${x.getDate()}–${y.getDate()} ${M[y.getMonth()]}` : `${fmtDay(a)} – ${fmtDay(b)}`;
};
export const iso = (date) => {
  const z = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const monthName = (ym) => { const [y, m] = ym.split("-"); return `${M[+m - 1]} ${y.slice(2)}`; };

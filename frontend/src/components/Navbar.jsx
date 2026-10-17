import { Link, NavLink } from "react-router-dom";
import { Heart, Moon, Sun, Bell } from "lucide-react";
import { useApp } from "@/context/AppState";

const links = [
  ["/search", "Explore", "nav-explore-link"],
  ["/trips/women-only-trips", "Women-only", "nav-women-link"],
  ["/operators", "Operators", "nav-all-operators-link"],
  // "For operators" (/list-your-departures) is hidden for now; the page itself still exists
];

// Crest used on the homepage hero: peaks over the name set on an arch.
function Emblem() {
  return (
    <svg viewBox="0 0 160 84" className="h-16 w-auto" fill="none" aria-label="Wayfind">
      <path d="M50 33 L66 13 L75 23 L85 8 L110 33" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M61 19.5 L66 13 L71 18.5 M80 15.5 L85 8 L91.5 14.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <defs><path id="wayfind-arch" d="M18 68 Q80 32 142 68" /></defs>
      <text fill="currentColor" fontSize="15" fontWeight="600" letterSpacing="5.5" style={{ fontFamily: '"DM Sans", sans-serif' }}>
        <textPath href="#wayfind-arch" startOffset="50%" textAnchor="middle">WAYFIND</textPath>
      </text>
      <path d="M80 68 C80.5 72.5 82.5 74.5 87 75 C82.5 75.5 80.5 77.5 80 82 C79.5 77.5 77.5 75.5 73 75 C77.5 74.5 79.5 72.5 80 68Z" fill="currentColor" />
    </svg>
  );
}

export default function Navbar({ overlay }) {
  const { hearts, dark, setDark, currency, setCurrency } = useApp();
  const tone = overlay ? "text-white" : "text-foreground";
  const navLink = ([to, l, id]) => (
    <NavLink key={to} to={to} data-testid={id} className={({ isActive }) => `opacity-80 transition-opacity hover:opacity-100 ${isActive ? "!opacity-100 font-semibold" : ""}`}>{l}</NavLink>
  );
  return (
    <header className={`${overlay ? "absolute" : "sticky bg-background/85 backdrop-blur-xl border-b"} top-0 inset-x-0 z-40`}>
      <div className={overlay
        ? `mx-auto flex h-[88px] w-full items-center gap-6 whitespace-nowrap px-4 sm:px-8 xl:w-[76%] ${tone}`
        : `mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3 sm:px-8 ${tone}`}>
        {overlay ? (
          <>
            <nav className="hidden flex-1 items-center gap-7 text-sm lg:flex">{links.slice(0, 3).map(navLink)}</nav>
            <Link to="/" data-testid="nav-logo" className="transition-transform duration-500 hover:scale-105"><Emblem /></Link>
          </>
        ) : (
          <>
            <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-coral text-white font-display text-lg font-bold">W</span>
              <span className="font-display text-xl font-semibold tracking-tight">Wayfind</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm md:flex">{links.map(navLink)}</nav>
          </>
        )}
        <div className={`flex items-center justify-end gap-1.5 ${overlay ? "ml-auto lg:ml-0 lg:flex-1" : "ml-auto"}`}>
          {overlay && <nav className="mr-3 hidden items-center text-sm lg:flex">{links.slice(3).map(navLink)}</nav>}
          <button data-testid="currency-toggle" onClick={() => setCurrency(currency === "inr" ? "usd" : "inr")}
            className="rounded-full border border-current/20 px-3 py-1.5 font-mono text-xs transition-colors hover:bg-white/10" title="Currency for international trips">
            {currency === "inr" ? "₹ INR" : "$ USD"}
          </button>
          <Link to="/alerts" data-testid="nav-alerts-link" className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10" aria-label="Alerts"><Bell size={18} /></Link>
          <Link to="/shortlist" data-testid="nav-shortlist-link" className="relative rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10" aria-label="Shortlist">
            <Heart size={18} />
            {hearts.length > 0 && <span data-testid="nav-shortlist-count" className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{hearts.length}</span>}
          </Link>
          <button data-testid="dark-mode-toggle" onClick={() => setDark(!dark)} className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10" aria-label="Toggle dark mode">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}

import { Link, NavLink } from "react-router-dom";
import { Heart, Moon, Sun, Bell } from "lucide-react";
import { useApp } from "@/context/AppState";
import Logo from "@/components/Logo";

const links = [
  ["/search", "Explore", "nav-explore-link"],
  ["/trips/women-only-trips", "Women-only", "nav-women-link"],
  ["/operators", "Operators", "nav-all-operators-link"],
  // "For operators" (/list-your-departures) is hidden for now; the page itself still exists
];

// Crest used on the homepage hero: the backpack mark in line, over the name set on an arch.
function Emblem() {
  return (
    <svg viewBox="0 0 160 84" className="h-16 w-auto" fill="none" aria-label="getPackd">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M74 11V9a6 6 0 0 1 12 0v2" />
        <rect x="67" y="11" width="26" height="25" rx="8" />
        <path d="M67.8 19 Q80 23 92.2 19" opacity=".6" />
        <rect x="73" y="25" width="14" height="8" rx="2.5" opacity=".6" />
      </g>
      <path d="M76.8 29l2.2 2 4-4.2" stroke="#FF6B4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs><path id="getpackd-arch" d="M20 66 Q80 46 140 66" /></defs>
      <text fill="currentColor" fontSize="15" fontWeight="600" letterSpacing="4.5" style={{ fontFamily: '"DM Sans", sans-serif' }}>
        <textPath href="#getpackd-arch" startOffset="50%" textAnchor="middle">GETPACKD</textPath>
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
            <Link to="/" data-testid="nav-logo">
              <Logo />
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

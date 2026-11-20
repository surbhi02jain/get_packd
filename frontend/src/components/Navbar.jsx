import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Heart, Bell, Menu, X } from "lucide-react";
import { useApp } from "@/context/AppState";
import Logo from "@/components/Logo";
import { hidden } from "@/lib/constants";

const links = [
  ["/search", "Explore", "nav-explore-link"],
  // women-only trips are a filter, not a section: they're first in Explore's category row (and in the footer)
  ["/operators", "Operators", "nav-all-operators-link"],
  ["/visas", "Visas", "nav-visas-link"],
  ["/about", "About us", "nav-about-link"],
  // "For operators" (/list-your-departures) is hidden for now; the page itself still exists
];

// One nav on every page, so nothing moves as you go: the logo, the links beside it, and currency and the shortlist on
// the right. On the home page (`overlay`) it lies see-through over the sketchbook, with no bar or bottom line.
// `children` go in the middle of the bar (the Explore page puts its search there), and push the links to wider
// screens. Wherever the links don't fit, a menu button on the right holds them. An account is optional: "log in" sits
// at the end (in the menu on phones), and once logged in your initial opens a small account menu.
export default function Navbar({ overlay, children }) {
  const { hearts, currency, setCurrency, user, checking, signOut } = useApp();
  const [open, setOpen] = useState(null); // "menu" (the links, where they don't fit) or "account"
  const menu = open === "menu";
  const setMenu = (on) => setOpen((o) => (typeof on === "function" ? (on(o === "menu") ? "menu" : null) : on ? "menu" : null));
  const box = useRef(null);
  const { pathname, search } = useLocation();
  const from = { from: pathname + search };
  const onAuthPage = /^\/(login|signup)/.test(pathname);
  // the links show from tablet width, or from wide screens when the search sits in the middle
  const wide = children ? "xl" : "md";

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !box.current?.contains(e.target) && setOpen(null);
    const esc = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const navLink = ([to, l, id]) => (
    <NavLink key={to} to={to} data-testid={id} className={({ isActive }) => `lowercase tracking-[.08em] transition-opacity hover:opacity-60 ${isActive ? "text-coral" : ""}`}>{l}</NavLink>
  );
  const iconBtn = "relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5 after:absolute after:-inset-1 after:content-['']";
  const panel = "absolute right-4 top-full z-50 -mt-1 flex w-60 flex-col rounded-2xl border border-[#e7dece] bg-[#fffdf9] p-2 text-[15px] shadow-[0_8px_28px_rgba(22,24,27,.12)] sm:right-8";
  const item = "rounded-xl px-4 py-2.5 text-left lowercase tracking-[.08em] transition-colors hover:bg-[#f1eadd]";
  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";

  return (
    <header ref={box} data-testid="navbar"
      className={`${overlay ? "absolute" : "sticky border-b bg-background/85 backdrop-blur-xl"} inset-x-0 top-0 z-40 text-foreground`}>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 sm:px-8">
        <Link to="/" data-testid="nav-logo" className="shrink-0">
          <Logo />
        </Link>
        <nav className={`hidden items-center gap-7 text-[15px] ${wide === "xl" ? "xl:flex" : "md:flex"}`}>{links.map(navLink)}</nav>
        {children && <div className="flex min-w-0 flex-1 justify-center">{children}</div>}
        <div className={`${children ? "" : "ml-auto"} flex items-center justify-end gap-1`}>
          <button data-testid="currency-toggle" onClick={() => setCurrency(currency === "inr" ? "usd" : "inr")}
            className="relative mr-1 rounded-full border border-current/20 px-3 py-1.5 font-mono text-xs transition-colors after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] hover:bg-black/5" title="Show prices in rupees or US dollars">
            {currency === "inr" ? "₹ INR" : "$ USD"}
          </button>
          {!hidden("alerts") && <Link to="/alerts" data-testid="nav-alerts-link" className={iconBtn} aria-label="Alerts"><Bell size={18} /></Link>}
          <Link to="/shortlist" data-testid="nav-shortlist-link" className={iconBtn} aria-label="Shortlist">
            <Heart size={18} />
            {hearts.length > 0 && <span data-testid="nav-shortlist-count" className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{hearts.length}</span>}
          </Link>
          {/* the account: "log in", or your initial; on phones both live in the menu */}
          {checking ? <span className="hidden h-9 w-9 md:block" />
            : user ? (
              <button data-testid="nav-account-button" onClick={() => setOpen((o) => (o === "account" ? null : "account"))} aria-expanded={open === "account"} aria-label={`Account: ${user.name}`}
                className="ml-1 hidden h-9 w-9 place-items-center rounded-full bg-[#16181b] text-[13px] font-medium text-white transition-opacity hover:opacity-85 md:grid">{initial}</button>
            ) : !onAuthPage && (
              <Link to="/login" state={from} data-testid="nav-login-link"
                className="ml-1 hidden rounded-full border border-current/20 px-3.5 py-1.5 text-[14px] lowercase tracking-[.06em] transition-colors hover:bg-black/5 md:inline-flex">log in</Link>
            )}
          <button data-testid="nav-menu-button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="nav-menu" aria-label={menu ? "Close menu" : "Menu"}
            className={`${iconBtn} ${wide === "xl" ? "xl:hidden" : "md:hidden"}`}>
            {menu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
      {menu && (
        <nav id="nav-menu" data-testid="nav-menu"
          className={`${panel} ${wide === "xl" ? "xl:hidden" : "md:hidden"}`}>
          {links.map(([to, l, id]) => (
            <NavLink key={to} to={to} data-testid={`${id}-menu`} onClick={() => setMenu(false)}
              className={({ isActive }) => `${item} ${isActive ? "text-coral" : ""}`}>{l}</NavLink>
          ))}
          {!checking && (
            <div className="mt-1 flex flex-col border-t border-[#e7dece] pt-1 md:hidden" data-testid="nav-menu-account">
              {user ? <>
                <p className="px-4 pb-1 pt-2.5 text-[12px] text-[#5f656b]">Logged in as <span className="font-medium text-[#16181b]">{user.name}</span></p>
                <button onClick={() => { setOpen(null); signOut(); }} data-testid="nav-logout-menu" className={item}>log out</button>
              </> : !onAuthPage && <>
                <Link to="/login" state={from} data-testid="nav-login-menu" className={item}>log in</Link>
                <Link to="/signup" state={from} data-testid="nav-signup-menu" className={item}>sign up</Link>
              </>}
            </div>
          )}
        </nav>
      )}
      {open === "account" && user && (
        <div data-testid="nav-account-menu" className={`${panel} hidden md:flex`}>
          <div className="px-4 pb-2 pt-2.5">
            <p className="truncate text-[15px] font-medium text-[#16181b]">{user.name}</p>
            <p className="truncate text-[13px] text-[#5f656b]">{user.email}</p>
          </div>
          <div className="flex flex-col border-t border-[#e7dece] pt-1">
            <Link to="/shortlist" className={item}>your shortlist{hearts.length > 0 && <span className="ml-1.5 text-[#5f656b]">{hearts.length}</span>}</Link>
            <button onClick={() => { setOpen(null); signOut(); }} data-testid="nav-logout" className={item}>log out</button>
          </div>
        </div>
      )}
    </header>
  );
}

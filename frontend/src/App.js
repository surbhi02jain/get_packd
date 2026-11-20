import { Suspense, lazy, useEffect, useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigationType, useParams, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plane } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/context/AppState";
import { CATEGORY_PAGES, hidden } from "@/lib/constants";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useInkPage } from "@/components/Ink";
import { track } from "@/lib/analytics";

// each page is its own download, fetched when it's first opened: the 3D sketchbook (three.js) comes only with the
// home page and the map (Leaflet) only with Explore, so no page carries the others' weight
const Home = lazy(() => import("@/pages/Home"));
const Results = lazy(() => import("@/pages/Results"));
const TripDetail = lazy(() => import("@/pages/TripDetail"));
const Operator = lazy(() => import("@/pages/Operator"));
const Operators = lazy(() => import("@/pages/Operators"));
const Visas = lazy(() => import("@/pages/Visas"));
const About = lazy(() => import("@/pages/About"));
const Login = lazy(() => import("@/pages/Login"));
const Landing = lazy(() => import("@/pages/Landing"));
const Compare = lazy(() => import("@/pages/Compare"));
const Admin = lazy(() => import("@/pages/Admin"));
const Shortlist = lazy(() => import("@/pages/Shortlist").then((m) => ({ default: m.Shortlist })));
const SharedShortlist = lazy(() => import("@/pages/Shortlist").then((m) => ({ default: m.SharedShortlist })));
const ListDepartures = lazy(() => import("@/pages/Misc").then((m) => ({ default: m.ListDepartures })));
const Alerts = lazy(() => import("@/pages/Misc").then((m) => ({ default: m.Alerts })));
// the review overlay used while building the site; never part of the live site
const Agentation = process.env.NODE_ENV === "development" ? lazy(() => import("agentation").then((m) => ({ default: m.Agentation }))) : null;

// a page view for the analytics each time the page (not just its filters) changes
function PageViews() {
  const { pathname } = useLocation();
  const last = useRef(null);
  useEffect(() => {
    if (last.current === pathname) return; // React's dev double-run
    last.current = pathname;
    track("page_view");
  }, [pathname]);
  return null;
}

// while a page's code is downloading: the empty paper it will be drawn on
const PageLoading = () => <div className="min-h-screen bg-[#f8f4ec]" aria-busy="true" data-testid="page-loading" />;

// one page failing doesn't take the site down; moving to another page starts fresh
function Pages({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}><Suspense fallback={<PageLoading />}>{children}</Suspense></ErrorBoundary>;
}


function Category() {
  const { slug } = useParams();
  const c = CATEGORY_PAGES[slug];
  if (!c) return <Navigate to="/search" replace />;
  return <Results key={slug} preset={c.params} title={c.title} sub={c.sub} />;
}

// every page is in the home page's sketchbook theme, except the /landing experiment, which has its own look
function InkTheme() {
  useInkPage();
  return null;
}
function SiteTheme() {
  const { pathname } = useLocation();
  return pathname.startsWith("/landing") ? null : <InkTheme />;
}

// Where each page was scrolled to, by history entry, so Back returns to the same spot in a long list of trips
const scrolls = new Map();

function PlaneSweep() {
  const { pathname, key } = useLocation();
  const nav = useNavigationType();
  const [k, setK] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    const save = () => scrolls.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [key]);
  useEffect(() => {
    if (nav === "POP" && scrolls.has(key)) {
      // the page may still be filling in (cached trips render a frame later): try for a moment until it's tall enough
      const y = scrolls.get(key);
      let tries = 0;
      const go = () => { window.scrollTo(0, y); if (Math.abs(window.scrollY - y) > 2 && tries++ < 40) requestAnimationFrame(go); };
      go();
    } else window.scrollTo(0, 0);
    if (first.current) { first.current = false; return; }
    setK((x) => x + 1);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AnimatePresence>
      {k > 0 && (
        <motion.div key={k} className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.55, duration: 0.2 }}>
          <motion.div className="h-1 bg-coral" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 0.6, ease: "easeInOut" }} />
          <motion.span className="absolute -top-2 text-coral" initial={{ left: "0%" }} animate={{ left: "98%" }} transition={{ duration: 0.6, ease: "easeInOut" }}><Plane size={18} className="rotate-45" /></motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// an address that isn't a page: say so, rather than quietly landing on the home page
function NotFound() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto max-w-[720px] px-5 py-24 text-center" data-testid="page-not-found">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-light text-[#16181b]">Page not found</h1>
        <p className="mt-3 text-[15px] text-[#5b6066]">There's nothing at this address. It may have moved, or the link has a typo.</p>
        <p className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px] font-semibold">
          <Link to="/" className="text-coral underline-offset-4 hover:underline">Home</Link>
          <Link to="/search" className="text-coral underline-offset-4 hover:underline">Explore trips</Link>
          <Link to="/about" className="text-coral underline-offset-4 hover:underline">About getPackd</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <SiteTheme />
        {/* for keyboard users: straight past the header to the page's content */}
        <a href="#main" className="sr-only z-[70] rounded-lg bg-[#16181b] px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3" data-testid="skip-link">Skip to content</a>
        <PlaneSweep />
        <PageViews />
        <Pages>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/search" element={<Results />} />
          <Route path="/trips/:slug" element={<Category />} />
          <Route path="/trip/:id" element={<TripDetail />} />
          <Route path="/operators" element={<Operators />} />
          <Route path="/visas" element={<Visas />} />
          <Route path="/visas/:key" element={<Visas />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/signup" element={<Login mode="signup" />} />
          <Route path="/operator/:id" element={<Operator />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/shortlist" element={<Shortlist />} />
          <Route path="/s/:id" element={<SharedShortlist />} />
          {/* alerts are hidden for now (lib/constants.js); the page only exists while they're offered */}
          <Route path="/alerts" element={hidden("alerts") ? <NotFound /> : <Alerts />} />
          <Route path="/list-your-departures" element={<ListDepartures />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Pages>
        <Toaster position="top-center" richColors />
        {Agentation && <Suspense fallback={null}><Agentation /></Suspense>}
      </BrowserRouter>
    </AppStateProvider>
  );
}

export default App;

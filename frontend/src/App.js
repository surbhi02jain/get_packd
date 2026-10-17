import { useEffect, useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plane } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/context/AppState";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import TripDetail from "@/pages/TripDetail";
import Operator from "@/pages/Operator";
import Operators from "@/pages/Operators";
import Compare from "@/pages/Compare";
import Admin from "@/pages/Admin";
import { Shortlist, SharedShortlist } from "@/pages/Shortlist";
import { ListDepartures, Alerts } from "@/pages/Misc";
import { CATEGORY_PAGES } from "@/lib/constants";

function Category() {
  const { slug } = useParams();
  const c = CATEGORY_PAGES[slug];
  if (!c) return <Navigate to="/search" replace />;
  return <Results key={slug} preset={c.params} title={c.title} sub={c.sub} />;
}

function PlaneSweep() {
  const { pathname } = useLocation();
  const [k, setK] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (first.current) { first.current = false; return; }
    setK((x) => x + 1);
  }, [pathname]);
  return (
    <AnimatePresence>
      {k > 0 && (
        <motion.div key={k} className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.55, duration: 0.2 }}>
          <motion.div className="h-1 bg-gradient-to-r from-amber via-coral to-coral" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 0.6, ease: "easeInOut" }} />
          <motion.span className="absolute -top-2 text-coral" initial={{ left: "0%" }} animate={{ left: "98%" }} transition={{ duration: 0.6, ease: "easeInOut" }}><Plane size={18} className="rotate-45" /></motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <PlaneSweep />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Results />} />
          <Route path="/trips/:slug" element={<Category />} />
          <Route path="/trip/:id" element={<TripDetail />} />
          <Route path="/operators" element={<Operators />} />
          <Route path="/operator/:id" element={<Operator />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/shortlist" element={<Shortlist />} />
          <Route path="/s/:id" element={<SharedShortlist />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/list-your-departures" element={<ListDepartures />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AppStateProvider>
  );
}

export default App;

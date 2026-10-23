import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { SlidersHorizontal, List, Map as MapIcon, CalendarDays, BellPlus, Wand2, Loader2, Search } from "lucide-react";
import { LABELS } from "@/lib/constants";
import { fmtRange, short } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/SearchBar";
import FilterRail from "@/components/FilterRail";
import DepartureCard from "@/components/DepartureCard";
import { SortMenu, PriceStrip, ActiveChips } from "@/components/ResultsBits";
import { MapView, CalendarView } from "@/components/Views";
import { CompareTray, SaveSearchDialog, FitQuiz, EmptyState, Skeletons } from "@/components/Overlays";
import { Counter, SampleBadge } from "@/components/Motion";
import { useApp } from "@/context/AppState";
import { http, qs } from "@/lib/api";

const VIEWS = [["list", List, "List"], ["map", MapIcon, "Map"], ["calendar", CalendarDays, "Calendar"]];

/** Plain page title: the collection or destination name and one line under it. */
function ResultsHeader({ title, sub, params }) {
  const place = params.q ? params.q.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  const heading = title || (place ? `Group trips in ${place}` : "Every group departure");
  const line = sub || (place ? "Every operator's upcoming dates for this destination, side by side." : "All operators, all dates, one list.");
  return (
    <header data-testid={title ? "category-header" : "results-hero"}>
      <p className="text-[11px] font-medium uppercase tracking-[.3em] text-muted-foreground">{title ? "Collection" : place ? "Destination" : "Explore"}</p>
      <h1 className="mt-1 font-elegant text-4xl sm:text-5xl">{heading}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{line}</p>
    </header>
  );
}

export default function Results({ preset = {}, title, sub }) {
  const [sp, setSp] = useSearchParams();
  const { quiz, setQuiz } = useApp();
  const url = Object.fromEntries(sp);
  const params = { ...preset, ...url };
  const [limit, setLimit] = useState(30);
  const [sheet, setSheet] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const view = params.view || "list";

  const update = (patch) => {
    const base = patch.__replace ? Object.fromEntries(Object.entries(url).filter(([k]) => ["sort", "view"].includes(k))) : { ...url };
    if (patch.__replace) Object.keys(preset).forEach((k) => { base[k] = ""; });
    Object.entries(patch).forEach(([k, v]) => {
      if (k === "__replace") return;
      if (v === null || v === undefined || v === "") { if (preset[k]) base[k] = ""; else delete base[k]; } else base[k] = String(v);
    });
    setSp(base, { replace: true });
    setLimit(30);
  };
  const clear = () => { const b = {}; Object.keys(preset).forEach((k) => { b[k] = ""; }); if (url.view) b.view = url.view; setSp(b, { replace: true }); };

  const apiParams = { ...Object.fromEntries(Object.entries(params).filter(([k, v]) => v && k !== "view")), ...(quiz || {}), limit };
  const key = qs(apiParams);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["search", key], queryFn: () => http.get(`/search?${key}`).then((r) => r.data), placeholderData: keepPreviousData,
  });
  const showTrue = params.true_price !== "0";
  const n = data?.total_departures;

  const rail = <FilterRail facets={data?.facets} params={params} update={update} bounds={data?.price_bounds} />;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="sticky top-[57px] z-30 border-b bg-background/85 py-3 backdrop-blur-xl" data-testid="sticky-search">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          {!expanded && (
            <button data-testid="mobile-search-summary" onClick={() => setExpanded(true)} className="flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left text-sm shadow-soft md:hidden">
              <Search size={16} className="text-coral" />
              <span className="min-w-0 truncate font-semibold">{[params.q || "Anywhere", params.start ? fmtRange(params.start, params.end || params.start) : "Any dates", params.as ? params.as.split(",").map((a) => LABELS.as[a]).join(", ") : null, params.max_price ? `≤ ${short(+params.max_price)}` : null].filter(Boolean).join(" · ")}</span>
            </button>
          )}
          <div className={expanded ? "" : "hidden md:block"}><SearchBar variant="sticky" initial={params} onSearch={(p) => { update(p); setExpanded(false); }} /></div>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1400px] gap-8 px-4 pt-6 sm:px-8 lg:grid-cols-[290px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-[150px] max-h-[calc(100vh-170px)] overflow-y-auto rounded-3xl border border-border/60 bg-card px-5 pb-4 shadow-soft no-scrollbar">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-card py-4"><p className="text-lg font-semibold">Filters</p>
              <button data-testid="rail-clear-all" onClick={clear} className="text-xs font-semibold underline">Clear all</button></div>
            {rail}
          </div>
        </aside>

        <section className="min-w-0 space-y-5 pb-28">
          <ResultsHeader title={title} sub={sub} params={params} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold" data-testid="result-counter">
                <Counter value={n} /> group trips <span className="text-muted-foreground">· <Counter value={data?.total_operators} /> operators</span>
                {isFetching && <Loader2 size={16} className="ml-2 inline animate-spin text-coral" />}
              </p>
              <div className="mt-1 flex items-center gap-2"><span className="text-xs text-muted-foreground">{data?.total_trips ?? "–"} distinct trips</span><SampleBadge /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <SortMenu sort={params.sort || "best"} onChange={(s) => update({ sort: s === "best" ? null : s })} />
              <button data-testid="open-fit-quiz" onClick={() => setQuizOpen(true)} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">
                <Wand2 size={15} className="text-coral" /> {quiz ? "Fit score on" : "Get my Fit score"}
              </button>
              {quiz && <button data-testid="fit-quiz-reset" onClick={() => setQuiz(null)} className="rounded-full px-2 text-xs underline">reset</button>}
              <button data-testid="save-search-button" onClick={() => setSaveOpen(true)} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted"><BellPlus size={15} /> Save this search</button>
              <button data-testid="mobile-filters-button" onClick={() => setSheet(true)} className="flex items-center gap-1.5 rounded-full bg-midnight px-4 py-2 text-sm font-semibold text-sand lg:hidden dark:bg-sand dark:text-midnight"><SlidersHorizontal size={15} /> Filters</button>
            </div>
          </div>

          <PriceStrip data={data?.price_strip} params={params} update={update} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ActiveChips params={params} update={update} clear={clear} preset={preset} />
            <div className="ml-auto flex rounded-full bg-muted p-1" data-testid="view-toggle">
              {VIEWS.map(([v, I, l]) => (
                <button key={v} data-testid={`view-toggle-${v}`} onClick={() => update({ view: v === "list" ? null : v })} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm ${view === v ? "bg-card font-semibold shadow-sm" : ""}`}><I size={14} /> {l}</button>
              ))}
            </div>
          </div>

          {isError ? (
            <div className="rounded-3xl bg-card p-10 text-center shadow-soft" data-testid="results-error">Something went wrong loading trips. <button onClick={() => refetch()} className="underline">Retry</button></div>
          ) : isLoading ? <Skeletons /> : n === 0 ? (
            <EmptyState relaxations={data.relaxations} update={update} clear={clear} />
          ) : view === "map" ? (
            <MapView points={data.map} onPick={(p) => update({ q: p.destination, view: null })} />
          ) : view === "calendar" ? (
            <CalendarView days={data.calendar} />
          ) : (
            <LayoutGroup>
              <div className="space-y-5" data-testid="results-list">
                <AnimatePresence mode="popLayout">
                  {data.clusters.map((c) => <DepartureCard key={c.trip_id} card={c.lead} cluster={c} showTrue={showTrue} showFitRing={!!quiz} />)}
                </AnimatePresence>
              </div>
              {data.relaxations?.length > 0 && <p className="text-sm text-muted-foreground">Want more options? {data.relaxations.map((r, i) => <button key={i} data-testid={`inline-relaxation-${i}`} onClick={() => update(r.patch)} className="ml-2 underline">{r.label} (+{r.add})</button>)}</p>}
              {data.has_more && (
                <div className="flex justify-center"><button data-testid="show-more-button" onClick={() => setLimit(limit + 30)} className="rounded-full border-2 border-midnight px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-midnight hover:text-sand dark:border-sand">Show more trips</button></div>
              )}
            </LayoutGroup>
          )}
        </section>
      </main>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="flex h-[88vh] flex-col rounded-t-[28px] p-0" data-testid="mobile-filter-sheet">
          <SheetHeader className="border-b px-5 py-4"><SheetTitle className="font-display text-xl">Filters</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-5">{rail}</div>
          <div className="flex gap-3 border-t p-4">
            <button onClick={clear} data-testid="sheet-clear-all" className="rounded-2xl border px-4 py-3 text-sm font-semibold">Clear all</button>
            <button onClick={() => setSheet(false)} data-testid="sheet-show-trips" className="flex-1 rounded-2xl bg-coral py-3 text-sm font-semibold text-white">Show {n ?? ""} trips</button>
          </div>
        </SheetContent>
      </Sheet>
      <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} params={params} count={n} />
      <FitQuiz open={quizOpen} onOpenChange={setQuizOpen} />
      <CompareTray />
      <Footer />
    </div>
  );
}

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellPlus, List, Loader2, Map as MapIcon, Search, Wand2 } from "lucide-react";
import { LABELS, hidden } from "@/lib/constants";
import { fmtRange } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar, { budgetLabel, travellersLabel } from "@/components/SearchBar";
import FilterRail from "@/components/FilterRail";
import TripTile from "@/components/TripTile";
import StyleBar from "@/components/StyleBar";
// the map (Leaflet) downloads the first time someone opens it; it starts closed
const PriceMap = lazy(() => import("@/components/PriceMap"));
import { SortMenu } from "@/components/ResultsBits";
import { CompareTray, SaveSearchDialog, FitQuiz, EmptyState } from "@/components/Overlays";
import { useApp } from "@/context/AppState";
import { http, qs } from "@/lib/api";
import { track } from "@/lib/analytics";
import { InkLabel, InkTitle } from "@/components/Ink";

// The Explore page laid out like Airbnb's search results: a search pill in the header, the trip styles as a row of
// categories with one Filters button, a grid of photo-first trips, and a map of prices beside them.

// what the Filters button counts: everything set from inside the filters popup
const FILTER_KEYS = ["gender", "dtype", "place", "country", "visa_easy", "dur", "climate", "incl", "op_type", "operator"];

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const FLEX_LABEL = { 2: "±2 days", month: "whole month", any: "any time" };

/**
 * On a phone: where, when, who and budget as two lines beside a search icon, which opens the full search (four
 * pickers don't fit in a row there). Wide screens have the search itself in the header (SearchBar variant "pill").
 */
function SearchPill({ params, onOpen, className = "" }) {
  const { currency } = useApp();
  const who = [travellersLabel(+params.seats || 0), params.gender === "women_only" ? "Women-only" : null].filter(Boolean).join(" · ")
    || (params.as ? params.as.split(",").map((a) => LABELS.as[a]).filter(Boolean).join(", ") : null);
  const where = params.q ? titleCase(params.q) : "Anywhere";
  const when = params.start ? `${fmtRange(params.start, params.end || params.start)}${FLEX_LABEL[params.flex] ? ` · ${FLEX_LABEL[params.flex]}` : ""}` : "Any dates";
  const budget = budgetLabel(+params.min_price || null, +params.max_price || null, currency);
  return (
    <button data-testid="search-pill-phone" onClick={onOpen}
      className={`flex min-w-0 items-center gap-3 rounded-full border border-[#e7dece] bg-[#fffdf9] px-5 py-2.5 text-left shadow-[0_3px_10px_rgba(0,0,0,.1)] ${className}`}>
      <Search size={18} strokeWidth={2.4} className="shrink-0 text-[#16181b]" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[#16181b]">{where}</span>
        <span className="block truncate text-xs text-[#5b6066]">{[when, who, budget].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-6 gap-y-10" data-testid="results-loading">
      {[...Array(6)].map((_, i) => (
        <div key={i}>
          <div className="shimmer aspect-[20/19] rounded-xl" />
          <div className="shimmer mt-3 h-4 w-2/3 rounded" /><div className="shimmer mt-2 h-4 w-1/2 rounded" /><div className="shimmer mt-2 h-4 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Results({ preset = {}, title, sub }) {
  const [sp, setSp] = useSearchParams();
  const { quiz, setQuiz, compare } = useApp();

  const url = Object.fromEntries(sp);
  const params = { ...preset, ...url };
  // how many trips are shown is in the address (replaced, not pushed), so going back to this page shows as many again
  const shown = Math.max(30, +sp.get("show") || 30);
  const [searching, setSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  // on wide screens: the map "split" beside the list, "full" across the page, or "off"; it starts collapsed, so the
  // trips get the whole width until someone opens it
  const [mapMode, setMapMode] = useState("off");
  const [mobileMap, setMobileMap] = useState(false); // the map in place of the list, on narrow ones
  const [hovered, setHovered] = useState(null);
  // once opened, the map stays mounted (it slides shut and opens again where it was)
  const mapUsed = useRef(false);
  if (mapMode !== "off" || mobileMap) mapUsed.current = true;

  // the header and the styles row stick together; the map and the opened search sit just under them, so measure both
  const bar = useRef(null);
  const [h, setH] = useState({ nav: 75, all: 155 });
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH({ nav: el.firstElementChild?.offsetHeight ?? 75, all: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const update = (patch, { replace = false } = {}) => {
    const base = patch.__replace ? Object.fromEntries(Object.entries(url).filter(([k]) => ["sort", "view"].includes(k))) : { ...url };
    if (patch.__replace) Object.keys(preset).forEach((k) => { base[k] = ""; });
    Object.entries(patch).forEach(([k, v]) => {
      if (k === "__replace") return;
      if (v === null || v === undefined || v === "") { if (preset[k]) base[k] = ""; else delete base[k]; } else base[k] = String(v);
    });
    delete base.show;
    // each change is a step in the browser's history, so Back undoes the last filter rather than leaving the search
    setSp(base, { replace });
  };
  // "Clear all" in the filters clears the filters, not where and when you're searching
  const KEEP = ["q", "start", "end", "flex", "sort", "view"];
  const clear = () => {
    const b = Object.fromEntries(Object.entries(url).filter(([k]) => KEEP.includes(k)));
    Object.keys(preset).forEach((k) => { b[k] = ""; });
    setSp(b);
  };

  const apiParams = { ...Object.fromEntries(Object.entries(params).filter(([k, v]) => v && !["view", "show"].includes(k))), ...(quiz || {}) };
  const key = qs(apiParams);
  // the first page is as long as the address says; "Show more" fetches only the next 30
  const { data: pages, isLoading, isFetching, isError, refetch, fetchNextPage, isFetchingNextPage, isPlaceholderData } = useInfiniteQuery({
    queryKey: ["search", key],
    queryFn: ({ pageParam }) => http.get(`/search?${key}&offset=${pageParam.offset}&limit=${pageParam.limit}`).then((r) => r.data),
    initialPageParam: { offset: 0, limit: shown },
    getNextPageParam: (last, all) => (last.has_more ? { offset: all.reduce((n, p) => n + p.clusters.length, 0), limit: 30 } : undefined),
    placeholderData: keepPreviousData,
  });
  const data = pages?.pages[0];
  const clusters = pages?.pages.flatMap((p) => p.clusters) ?? [];
  const hasMore = pages?.pages[pages.pages.length - 1]?.has_more;
  const more = () => { fetchNextPage(); setSp({ ...url, show: String(clusters.length + 30) }, { replace: true }); };

  // each search someone makes (a place, dates or a filter), once its results are in: what they looked for and how
  // many departures it found, so searches that find nothing show up in the analytics
  const tracked = useRef(null);
  useEffect(() => {
    if (!data || isPlaceholderData || tracked.current === key) return;
    tracked.current = key;
    const filters = Object.keys(apiParams).filter((k) => !["sort", "true_price"].includes(k));
    if (!filters.length) return;
    track("search", { q: params.q || null, results: data.total_departures, dates: !!params.start, filters: filters.join(",").slice(0, 200) });
  }, [data, isPlaceholderData, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // a sentence typed into Where ("beach trip for New Year") comes back read as filters: put those in the address, so
  // the search pill and the filters show what was understood
  useEffect(() => {
    if (!data?.interpreted) return;
    toast.success(`Showing: ${data.interpreted.summary}`);
    // replaced, not pushed: Back shouldn't land on the sentence again, which would only be read again
    update({ ...data.interpreted.params, q: data.interpreted.params.q ?? null }, { replace: true });
  }, [data?.interpreted]); // eslint-disable-line react-hooks/exhaustive-deps
  const showTrue = params.true_price !== "0";
  const n = data?.total_departures;
  // what the Filters button counts: filters someone set, not the one a collection page stands for (its title says it);
  // travellers (seats) are set in the search pill, not the popup
  const set = (k) => params[k] && params[k] !== preset[k];
  const filterCount = FILTER_KEYS.reduce((s, k) => s + (set(k) ? String(params[k]).split(",").length : 0), 0)
    + (set("min_price") || set("max_price") ? 1 : 0);
  const place = params.q ? titleCase(data?.corrected_q || params.q) : null;
  const heading = title || (place ? `Group trips in ${place}` : null);
  const pick = (p) => { update({ q: p.destination }); setMobileMap(false); };
  // Esc closes the opened search, as clicking outside it does
  useEffect(() => {
    if (!searching) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("[data-radix-popper-content-wrapper]")) setSearching(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searching]);
  const top = h.all;

  return (
    <div className="air min-h-screen">
      <div ref={bar} className="sticky top-0 z-40">
        <Navbar><SearchBar variant="pill" initial={params} onSearch={update} onLive={update} className="hidden w-full max-w-[600px] md:flex" /></Navbar>
        <div className="border-b border-[#e7dece] bg-[#f8f4ec]" data-testid="sticky-search">
          <div className="mx-auto max-w-[2000px] px-4 pt-3 sm:px-6 lg:px-10">
            <SearchPill params={params} onOpen={() => setSearching(true)} className={`mb-3 w-full md:hidden ${searching ? "invisible" : ""}`} />
            <StyleBar counts={data?.facets?.style} active={params.style && !params.style.includes(",") ? params.style : null}
              onPick={(s, also) => update({ style: s, ...also })} filterCount={filterCount} onFilters={() => setFiltersOpen(true)}
              womenOnly={params.gender === "women_only"} onWomenOnly={(on) => update({ gender: on ? "women_only" : null })} />
          </div>
        </div>
      </div>

      {searching && (
        <>
          <div className="fixed inset-0 z-30 bg-black/25" onClick={() => setSearching(false)} data-testid="search-scrim" />
          <div className="fixed inset-x-0 z-50 border-b border-[#e7dece] bg-[#f8f4ec] px-4 pb-6 pt-4 sm:px-8" style={{ top: h.nav }}>
            <div className="mx-auto max-w-[1000px]"><SearchBar variant="sticky" initial={params} onSearch={(p) => { update(p); setSearching(false); }} onLive={update} /></div>
          </div>
        </>
      )}

      <main id="main" className="mx-auto flex max-w-[2000px]">
        <section className={`min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 ${mobileMap ? "max-lg:hidden" : ""} ${mapMode === "full" ? "lg:hidden" : ""}`}>
          {heading && (
            <header className="mb-4" data-testid={title ? "category-header" : "results-hero"}>
              <h1 className="text-[26px] font-semibold leading-tight text-[#16181b]">{heading}</h1>
              {sub && <p className="mt-1 text-[15px] text-[#5b6066]">{sub}</p>}
              {data?.corrected_q && <p className="mt-1 text-[15px] text-[#5b6066]" data-testid="results-corrected">Showing results for <b className="font-semibold text-[#16181b]">{data.corrected_q}</b>. No trips matched “{params.q}”.</p>}
            </header>
          )}
          {!heading && (
            <header className="mb-6" data-testid="results-hero">
              <InkLabel>Explore</InkLabel>
              <InkTitle as="h1" className="mt-2 !text-[clamp(1.9rem,3.2vw,2.8rem)]" ink="side by side.">Every group trip,</InkTitle>
            </header>
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#16181b]" data-testid="result-counter">
              {n != null ? `${n.toLocaleString("en-IN")} group ${n === 1 ? "departure" : "departures"}` : "Group departures"}
              {data && <span className="font-normal text-[#5b6066]"> · {data.total_trips} {data.total_trips === 1 ? "trip" : "trips"} from {data.total_operators} {data.total_operators === 1 ? "operator" : "operators"}</span>}
              {isFetching && <Loader2 size={14} className="ml-2 inline animate-spin text-[#5b6066]" />}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {/* on wide screens the map opens beside the list from here; its own handle widens or closes it */}
              <button data-testid="map-toggle-wide" onClick={() => setMapMode((m) => (m === "off" ? "split" : "off"))}
                className="hidden items-center gap-1.5 rounded-full border border-[#e7dece] bg-[#fffdf9] px-4 py-2 font-medium text-[#16181b] transition-colors hover:border-[#16181b] lg:flex">
                <MapIcon size={15} /> {mapMode === "off" ? "Show map" : "Hide map"}
              </button>
              <SortMenu sort={params.sort || "best"} onChange={(s) => update({ sort: s === "best" ? null : s })} />
              {!hidden("fitScore") && <button data-testid="open-fit-quiz" onClick={() => setQuizOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold text-[#16181b] underline-offset-4 hover:bg-black/[.04] hover:underline">
                <Wand2 size={15} /> {quiz ? "Fit score on" : "Fit score"}
              </button>}
              {quiz && !hidden("fitScore") && <button data-testid="fit-quiz-reset" onClick={() => setQuiz(null)} className="text-xs text-[#5b6066] underline">reset</button>}
              {!hidden("saveSearch") && <button data-testid="save-search-button" onClick={() => setSaveOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold text-[#16181b] underline-offset-4 hover:bg-black/[.04] hover:underline">
                <BellPlus size={15} /> Save search
              </button>}
            </div>
          </div>

          {isError ? (
            <div className="rounded-xl border border-[#e7dece] p-10 text-center" data-testid="results-error">Something went wrong loading trips. <button onClick={() => refetch()} className="font-semibold underline">Retry</button></div>
          ) : isLoading ? <GridSkeleton /> : n === 0 ? (
            <EmptyState relaxations={data.relaxations} update={update} clear={clear} />
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-6 gap-y-10" data-testid="results-list">
                {clusters.map((c) => <TripTile key={c.trip_id} card={c.lead} cluster={c} showTrue={showTrue} onHover={setHovered} womenOnlyPage={params.gender === "women_only"} />)}
              </div>
              {data.relaxations?.length > 0 && (
                <p className="mt-8 text-sm text-[#5b6066]">Want more options? {data.relaxations.map((r, i) => <button key={i} data-testid={`inline-relaxation-${i}`} onClick={() => update(r.patch)} className="ml-2 font-semibold text-[#16181b] underline">{r.label} (+{r.add})</button>)}</p>
              )}
              {hasMore && (
                <div className="mt-12 flex flex-col items-center gap-3">
                  <p className="text-[15px] font-semibold text-[#16181b]">Continue exploring group trips</p>
                  <button data-testid="show-more-button" onClick={more} disabled={isFetchingNextPage} className="flex items-center gap-2 rounded-lg bg-coral px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:brightness-[.88] disabled:opacity-70">
                    {isFetchingNextPage && <Loader2 size={16} className="animate-spin" />} Show more
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* stays mounted when collapsed, so the map slides shut and opens again where it was */}
        <aside className={`hidden shrink-0 transition-[width] duration-300 ease-out lg:block ${mapMode === "full" ? "lg:w-full" : mapMode === "split" ? "lg:w-[42%] xl:w-[40%]" : "lg:w-0"}`}
          inert={mapMode === "off"}>
          <div className="sticky" style={{ top, height: `calc(100vh - ${top}px)` }}>
            {mapUsed.current && <Suspense fallback={null}><PriceMap points={data?.map} active={hovered} onPick={pick} className="h-full" mode={mapMode} onMode={setMapMode} /></Suspense>}
          </div>
        </aside>
      </main>
      {mobileMap && <div className="fixed inset-x-0 bottom-0 z-20 lg:hidden" style={{ top }}><Suspense fallback={null}><PriceMap points={data?.map} onPick={pick} className="h-full" /></Suspense></div>}

      {/* on phones, Airbnb's floating switch between the list and the map; wide screens use the map's own handle */}
      <button data-testid="map-toggle" onClick={() => setMobileMap((m) => !m)}
        className={`fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-coral px-5 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,.2)] transition-transform hover:scale-105 lg:hidden ${compare.length ? "bottom-28" : "bottom-8"}`}>
        {mobileMap ? <>Show list <List size={16} /></> : <>Show map <MapIcon size={16} /></>}
      </button>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="air flex max-h-[88vh] max-w-[720px] flex-col gap-0 overflow-hidden rounded-xl bg-[#fffdf9] p-0" data-testid="filters-dialog"
          onCloseAutoFocus={(e) => { e.preventDefault(); document.querySelector('[data-testid="open-filters"]')?.focus(); }}>
          <div className="border-b border-[#e7dece] py-5 text-center">
            <DialogTitle className="text-base font-semibold">Filters</DialogTitle>
            <DialogDescription className="sr-only">Narrow the departures; the results update as you pick.</DialogDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-6">
            <FilterRail facets={data?.facets} params={params} update={update} bounds={data?.price_bounds} hide={["Seats available"]} />
          </div>
          <div className="flex items-center justify-between border-t border-[#e7dece] px-6 py-4">
            <button onClick={clear} data-testid="filters-clear-all" className="rounded-lg px-2 py-2 text-[15px] font-semibold text-[#16181b] underline">Clear all</button>
            <button onClick={() => setFiltersOpen(false)} data-testid="filters-show-trips" className="rounded-lg bg-coral px-6 py-3 text-[15px] font-semibold text-white hover:brightness-[.88]">
              Show {n != null ? n.toLocaleString("en-IN") : ""} {n === 1 ? "departure" : "departures"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} params={params} count={n} />
      <FitQuiz open={quizOpen} onOpenChange={setQuizOpen} />
      <CompareTray />
      <Footer />
    </div>
  );
}

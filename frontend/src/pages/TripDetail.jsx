import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, Clock, ExternalLink, MapPin, Users, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TripPhoto from "@/components/TripPhoto";
import TripTile, { STALE_DAYS } from "@/components/TripTile";
import { OffToOperator } from "@/components/LeadForm";
import { HeartButton } from "@/components/HeartButton";
import { CompareTray } from "@/components/Overlays";
import { SeasonStrip } from "@/components/Season";
import { InstaCount, lineIcon } from "@/components/TripBits";
import { VisaBadge } from "@/pages/Visas";
import { useApp } from "@/context/AppState";
import { LABELS } from "@/lib/constants";
import { fmtRange, money, todayIso } from "@/lib/format";
import { http } from "@/lib/api";
import { track } from "@/lib/analytics";

// A trip, as a page of the travel journal: the photo taped in, and only what someone decides on: when it runs and what
// it costs, what's included (only when the operator lists it), where it starts, any visa, when to go, and who runs it.
// Sections the imported data has nothing for are left out rather than filled with "check with the operator".

/** A section heading in light Jost, with a handwritten aside in blue ink. */
function Heading({ children, aside }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-3 text-[26px] font-light leading-tight text-[#16181b]">
      {children}{aside && <span className="font-['Caveat'] text-[22px] text-coral">{aside}</span>}
    </h2>
  );
}

const Section = ({ children, testId }) => <section className="border-t border-[#e7dece] py-8" data-testid={testId}>{children}</section>;

const seatsNote = (d) => (d.status === "filling" ? "Filling fast" : d.seats_left != null && d.seats_left <= 8 ? `${d.seats_left} seats left` : null);

export default function TripDetail() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const [off, setOff] = useState(false);
  const { currency } = useApp();
  const { data, isLoading, isError } = useQuery({ queryKey: ["trip", id], queryFn: () => http.get(`/trips/${id}`).then((r) => r.data) });
  const deps = useMemo(() => data?.departures || [], [data]);
  // the date asked for, or else the next one you could still join (not one leaving today), or else the first
  const sel = useMemo(() => deps.find((x) => x.dep_id === sp.get("dep"))
    || deps.find((x) => x.status !== "cancelled" && x.start > todayIso()) || deps.find((x) => x.status !== "cancelled") || deps[0], [deps, sp]);

  if (isLoading) return <div className="min-h-screen"><Navbar /><div className="mx-auto max-w-[1120px] space-y-4 p-8"><div className="shimmer h-10 w-2/3 rounded" /><div className="shimmer aspect-[2/1] rounded-[3px]" /></div></div>;
  if (isError || !data) return <div className="min-h-screen"><Navbar /><p className="p-20 text-center" data-testid="trip-not-found">Trip not found. <Link to="/search" className="underline">Back to all trips</Link></p><Footer /></div>;

  const { trip, operator: op, similar } = data;
  const place = data.destination?.name ?? trip.destinations?.[0] ?? "";
  const opLink = trip.url || op.website;
  const intl = trip.domestic_or_international === "international";
  const included = trip.inclusion_list || [];
  const excluded = trip.exclusions || [];
  // when the operator gives no lists, the checklist we read from their page (meals, stays, transport...), known lines only
  const known = (sel?.breakdown || []).filter((l) => l.status && l.status !== "unknown");
  const womenOnly = trip.gender_policy === "women_only";
  const price = sel ? money(sel.true_price, currency, intl) : null;
  // someone leaving for the operator's site: the click the analytics counts per operator and trip
  const booked = (where) => () => {
    setOff(true);
    track("book_click", { op: op.id, trip: trip.id, dep: sel?.dep_id ?? null, price: sel?.true_price ?? null, where });
  };
  const gstAdded = sel && sel.true_price > sel.price ? sel.true_price - sel.price : 0;
  const stale = sel && sel.last_verified_days > STALE_DAYS;
  const readWhen = sel ? (sel.last_verified_days === 0 ? "today" : `${sel.last_verified_days} days ago`) : "";
  // known checklist lines, for trips whose operator gives no lists: what's included, and what isn't (or costs extra)
  const knownIn = known.filter((l) => l.status === "included" || l.status === "partial");
  const knownOut = known.filter((l) => l.status === "not_included" || l.status === "estimated");
  // where the group sets off: the city whose bus or train the operator includes, or the one the trip's name gives
  const startsLine = trip.starts_from_how === "included"
    ? `Travel from ${trip.starts_from} is included, as ${op.name} lists it: “${trip.starts_from_line}”`
    : trip.starts_from_how === "title"
      ? `The trip's name says it leaves from ${trip.starts_from}. Check with ${op.name} what travel from there includes.`
      : (trip.inclusion_list || []).some((x) => /\b(volvo|bus|train|flights?|tempo|traveller|cab|pick ?-?up)\b/i.test(x))
        ? "See what's included above for travel to the start."
        : `Getting there is up to you${intl && sel?.flights_est ? `; return flights are around ${money(sel.flights_est, currency, intl)}` : ""}.`;
  const days = sel?.duration ?? trip.duration_days;
  const initials = sel?.op.initials ?? op.name.replaceAll("&", " ").split(/\s+/).filter((w) => w && !/^(and|the|of)$/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const facts = [
    [Clock, `${days} ${days === 1 ? "day" : "days"}`],
    trip.max_group ? [Users, `Groups of up to ${trip.max_group}`] : null,
    [CalendarDays, `${deps.length} ${deps.length === 1 ? "date" : "dates"} to choose from`],
    [Users, womenOnly ? "Women-only group" : "Mixed group"],
  ].filter(Boolean);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto max-w-[1120px] px-5 pb-28 pt-6 sm:px-8">
        <Link to="/search" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5b6066] hover:text-[#16181b]"><ArrowLeft size={15} /> All trips</Link>

        <header className="mt-4" data-testid="trip-hero">
          <h1 className="text-[clamp(2rem,4vw,3.2rem)] font-light leading-[1.05] tracking-[-.01em] text-[#16181b]" data-testid="trip-title">{trip.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[#5b6066]">
            <span className="font-medium text-[#16181b]">{place}</span><span aria-hidden>·</span>
            <span>by <Link to={`/operator/${op.id}`} className="font-medium text-[#16181b] underline underline-offset-2" data-testid="trip-operator-link">{op.name}</Link></span>
            {womenOnly && <span className="ml-1 -rotate-3 rounded-[3px] border-[1.5px] border-[#c9302a] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#c9302a]">Women only</span>}
          </p>
        </header>

        {/* the photo, taped into the journal as a print */}
        <div className="relative mt-6 rotate-[-.6deg] rounded-[3px] bg-[#fffdf9] p-2.5 shadow-[0_2px_4px_rgba(60,45,20,.1),0_24px_40px_-24px_rgba(60,45,20,.4)]">
          <span aria-hidden className="absolute -top-3 left-10 z-10 h-6 w-24 rotate-[-4deg] bg-[#e9dfc6]/85" />
          <span aria-hidden className="absolute -top-3 right-10 z-10 h-6 w-24 rotate-[5deg] bg-[#e9dfc6]/85" />
          <TripPhoto large src={trip.image} dest={trip.destination_slug} alt={trip.title} className="block aspect-[2/1] max-h-[520px] w-full rounded-[2px] object-cover" />
          {sel && <div className="absolute right-6 top-6"><HeartButton id={sel.dep_id} /></div>}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <ul className="flex flex-wrap gap-x-7 gap-y-3 pb-8 text-[15px] text-[#16181b]" data-testid="trip-facts">
              {facts.map(([Icon, text]) => <li key={text} className="flex items-center gap-2"><Icon size={18} strokeWidth={1.7} className="text-[#5b6066]" /> {text}</li>)}
            </ul>

            {sel?.status === "cancelled" && (
              <div className="mb-8 flex items-start gap-3 rounded-[3px] border-[1.5px] border-dashed border-[#c9302a]/60 bg-[#c9302a]/[.05] p-5 text-[#7d1d17]" data-testid="cancelled-banner">
                <AlertTriangle className="shrink-0" /><div><p className="font-semibold">{op.name} cancelled the {fmtRange(sel.start, sel.end)} departure.</p><p className="text-sm">Pick another date below; the others are unaffected.</p></div>
              </div>
            )}

            <Section testId="trip-dates">
              <Heading aside={`${deps.length} to choose from`}>Pick a date</Heading>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {deps.map((d) => {
                  const on = d.dep_id === sel?.dep_id;
                  const note = d.status === "cancelled" ? "Cancelled" : seatsNote(d);
                  return (
                    <button key={d.dep_id} data-testid={`trip-dep-${d.dep_id}`} onClick={() => setSp({ dep: d.dep_id }, { replace: true })}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${on ? "border-coral bg-coral/[.05] ring-1 ring-coral" : "border-[#e7dece] bg-[#fffdf9] hover:border-[#16181b]"}`}>
                      <p className="text-[15px] font-semibold text-[#16181b]">{fmtRange(d.start, d.end)}</p>
                      <p className="text-sm text-[#5b6066]">{money(d.true_price, currency, intl)}</p>
                      {note && <p className="mt-1 text-xs font-medium text-[#a3271f]">{note}</p>}
                    </button>
                  );
                })}
              </div>
            </Section>

            {(included.length > 0 || excluded.length > 0 || known.length > 0) && (
              <Section testId="trip-inclusions">
                <Heading aside={`as ${op.name} lists it`}>What's included</Heading>
                {included.length + excluded.length > 0 ? (
                  <div className="mt-5 grid gap-8 sm:grid-cols-2">
                    {included.length > 0 && <ul className="space-y-2.5 text-[15px] text-[#16181b]">{included.map((x, i) => <li key={i} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0" /> {x}</li>)}</ul>}
                    {excluded.length > 0 && <div><p className="text-sm font-semibold text-[#16181b]">Not included</p><ul className="mt-2.5 space-y-2.5 text-[15px] text-[#5b6066]">{excluded.map((x, i) => <li key={i} className="flex gap-2.5"><X size={18} className="mt-0.5 shrink-0 text-[#c9302a]" /> {x}</li>)}</ul></div>}
                  </div>
                ) : (
                  <div className="mt-5 grid gap-8 sm:grid-cols-2">
                    {knownIn.length > 0 && <ul className="space-y-2.5 text-[15px] text-[#16181b]">{knownIn.map((l) => <li key={l.key} className="flex items-center gap-2.5">{lineIcon(l.status, 18)} {l.label}{l.status === "partial" ? " (partly)" : ""}</li>)}</ul>}
                    {knownOut.length > 0 && <div><p className="text-sm font-semibold text-[#16181b]">Not included</p><ul className="mt-2.5 space-y-2.5 text-[15px] text-[#5b6066]">{knownOut.map((l) => <li key={l.key} className="flex items-center gap-2.5">{lineIcon(l.status, 18)} {l.amount ? `${l.key === "taxes" ? "GST (5%)" : l.label}: + ${money(l.amount, currency, intl)} on top of the listed price` : l.label}</li>)}</ul></div>}
                  </div>
                )}
                {/* the operator says GST is extra; the price getPackd shows already has it added, so it isn't counted twice */}
                {gstAdded > 0 && <p className="mt-5 text-sm text-[#5b6066]" data-testid="trip-gst-note">The price on getPackd already adds the 5% GST {op.name} charges: {money(sel.true_price, currency, intl)} rather than the listed {money(sel.price, currency, intl)}.</p>}
              </Section>
            )}

            {(trip.meeting_point || trip.starts_from) && (
              <Section testId="trip-meeting">
                <Heading>Where it starts</Heading>
                <p className="mt-4 flex items-start gap-2.5 text-[15px] text-[#16181b]"><MapPin size={18} className="mt-0.5 shrink-0" />
                  {trip.starts_from_how === "included"
                    ? <span>From {trip.starts_from}{trip.meeting_point && trip.meeting_point.toLowerCase() !== trip.starts_from.toLowerCase() ? `; the trip itself begins at ${trip.meeting_point}` : ""}</span>
                    : <span>{trip.meeting_point || trip.starts_from}{trip.end_point ? `, ending at ${trip.end_point}` : ""}</span>}
                </p>
                <p className="mt-1 pl-7 text-sm text-[#5b6066]" data-testid="trip-getting-there">{startsLine}</p>
              </Section>
            )}

            {data.visas?.length > 0 && (
              <Section testId="trip-visa">
                <Heading aside="for Indian passports">Visa</Heading>
                <ul className="mt-5 space-y-3">
                  {data.visas.map((v) => (
                    <li key={v.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-[#16181b]" data-testid={`trip-visa-${v.key}`}>
                      <span className="text-xl leading-none" aria-hidden>{v.flag}</span>
                      <span className="font-semibold">{v.country}</span><VisaBadge kind={v.kind} />
                      <span className="text-[#5b6066]">{v.headline}</span>
                      <Link to={`/visas/${v.key}`} data-testid={`trip-visa-details-${v.key}`} className="text-sm font-medium text-coral hover:underline">Details →</Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {data.season && (
              <Section testId="trip-season">
                <Heading>When to go to {place}</Heading>
                <div className="mt-5"><SeasonStrip season={data.season} departures={deps} selected={sel} /></div>
              </Section>
            )}

            <Section testId="trip-operator">
              <Heading>Who runs it</Heading>
              <div className="mt-5 flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#16181b] text-sm font-semibold text-white" aria-hidden>{initials}</span>
                <div className="min-w-0 text-[15px]">
                  <Link to={`/operator/${op.id}`} className="font-semibold text-[#16181b] hover:underline">{op.name}</Link>
                  <p className="text-[#5b6066]">{LABELS.op_type[op.category] || "Group trip operator"}</p>
                  <p className="mt-1"><InstaCount handle={op.instagram} followers={op.instagram_followers} at={op.instagram_followers_at} source={op.instagram_followers_source} full /></p>
                  <p className="mt-3 text-sm text-[#5b6066]">getPackd lists operators and reads their trips; it doesn't vet them. Look at their reviews before you book.</p>
                </div>
              </div>
            </Section>
          </div>

          {/* the price, and the one thing to do next */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl bg-card p-6 shadow-lift" data-testid="trip-booking-panel">
              {sel && <>
                <p className="text-[#16181b]"><span className="text-[26px] font-semibold">{price}</span> <span className="text-[#5b6066]">per person</span></p>
                {sel.true_price !== sel.price && <p className="text-sm text-[#5b6066]">incl. 5% GST the operator adds</p>}
                <div className="mt-5 rounded-xl border border-[#e7dece] px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[.1em] text-[#5f656b]">Dates</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-[#16181b]">{fmtRange(sel.start, sel.end)}</p>
                  {seatsNote(sel) && <p className="text-sm font-medium text-[#a3271f]">{seatsNote(sel)}</p>}
                </div>
                {opLink && <a href={opLink} target="_blank" rel="noreferrer" onClick={booked("price_card")} data-testid="go-to-operator-button"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coral py-3.5 text-[15px] font-semibold text-white transition-colors hover:brightness-[.88]">Book on {op.name} <ExternalLink size={15} /></a>}
                <p className="mt-3 text-center font-['Caveat'] text-[19px] leading-tight text-[#5b6066]">
                  No payment on getPackd. Price read from their site {readWhen}.
                </p>
                {stale && <p className="mt-2 text-center text-sm text-[#a3271f]" data-testid="trip-stale">We couldn't read {op.name}'s site for {sel.last_verified_days} days, so this price may have changed. Check it on their site.</p>}
              </>}
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="border-t border-[#e7dece] pt-10" data-testid="trip-similar">
            <Heading aside="same place, other operators">More trips to {place}</Heading>
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-10">
              {similar.map((c) => <TripTile key={c.trip_id} card={c} />)}
            </div>
          </section>
        )}
      </main>

      {sel && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[#e7dece] bg-card/95 p-3 backdrop-blur lg:hidden" data-testid="mobile-book-bar">
          {/* the same notes as the price card on wide screens: per person, any GST added, no payment here, how fresh */}
          <div className="min-w-0 text-xs leading-snug text-[#5b6066]">
            <p><span className="text-lg font-semibold text-[#16181b]">{price}</span> per person</p>
            <p>{fmtRange(sel.start, sel.end)}{gstAdded > 0 ? " · incl. 5% GST" : ""}</p>
            <p className={stale ? "text-[#a3271f]" : ""}>No payment here · read {readWhen}</p>
          </div>
          {opLink && <a href={opLink} target="_blank" rel="noreferrer" onClick={booked("phone_bar")} data-testid="mobile-operator-button"
            className="flex max-w-[46%] shrink-0 items-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-left text-sm font-semibold leading-tight text-white">Book on {op.name} <ExternalLink size={14} className="shrink-0" /></a>}
        </div>
      )}
      <OffToOperator open={off} onOpenChange={setOff} trip={trip} dep={sel} destination={place} operator={op.name} />
      <CompareTray />
      <Footer />
    </div>
  );
}

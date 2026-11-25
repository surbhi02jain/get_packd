import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronDown, Compass, Tag, CalendarDays, Users, Store, Instagram } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppState";
import { http } from "@/lib/api";
import { fmtRange, compact, money } from "@/lib/format";
import { STYLES } from "@/lib/constants";
import { norm, sharedPlaces, markPlaces } from "@/lib/places";
import TripPhoto from "@/components/TripPhoto";

// A day the operator gives no heading leads with its first sentence (as on the trip page)
const titled = (d) => {
  if (!d || d.title) return d;
  const m = /^(.{8,110}?[.!?])\s+(.+)$/s.exec(d.description || "");
  return m ? { ...d, title: m[1], description: m[2] } : { ...d, title: d.description, description: "" };
};

// One short card per trip, side by side: five facts, each on the same line in every card (type, price, dates, seats,
// who runs it). The day-by-day opens below only when asked for.
export default function Compare() {
  const [sp, setSp] = useSearchParams();
  const { compare, setCompare, currency } = useApp();
  const [showDays, setShowDays] = useState(false);
  const deps = sp.get("deps") || "";
  const ids = deps.split(",").filter(Boolean);
  // the cards are the trips in the address (a shared link works the same for everyone); removing one takes it out of
  // the address, and out of your own tray if it's there
  const remove = (depId) => {
    const left = ids.filter((d) => d !== depId);
    setSp(left.length ? { deps: left.join(",") } : {}, { replace: true });
    if (compare.some((c) => c.dep_id === depId)) setCompare(compare.filter((c) => c.dep_id !== depId));
  };
  // picking another date of the same trip swaps that card in place (and in the tray)
  const switchDate = (fromId, to) => {
    setSp({ deps: ids.map((d) => (d === fromId ? to.dep_id : d)).join(",") }, { replace: true });
    if (compare.some((c) => c.dep_id === fromId)) setCompare(compare.map((c) => (c.dep_id === fromId ? { ...c, dep_id: to.dep_id, true_price: to.price } : c)));
  };
  const { data, isLoading } = useQuery({ queryKey: ["compare", deps], queryFn: () => http.get(`/compare?deps=${encodeURIComponent(deps)}`).then((r) => r.data), enabled: !!deps, placeholderData: (prev) => prev });
  const items = data?.items || [];
  const n = items.length;
  const fmt = (v, card) => money(v, currency, card.dtype === "international");

  // day by day, and the place the trips are named after when their plans share it ("Annapurna Base Camp": Day 4 vs Day 6)
  const daysOf = items.map(({ trip }) => (trip?.itinerary_days || []).map(titled));
  const maxDays = Math.max(0, ...daysOf.map((d) => d.length));
  const titles = items.map(({ card }) => norm(card.title)).join(" ");
  const key = n > 1 ? sharedPlaces(daysOf).filter((p) => titles.includes(p.key)).sort((a, b) => b.key.length - a.key.length)[0] : null;

  // seats only show when at least one of the trips publishes them; otherwise the line would be dashes all along
  const anySeats = items.some(({ card }) => card.seats_left != null || card.max_group != null);
  const rows = anySeats ? 7 : 6;
  const cols = { gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(min(72vw, 220px), 1fr))` };
  const Fact = ({ icon: Icon, label, children }) => (
    <p className="flex items-start gap-2.5"><Icon size={15} className="mt-[3px] shrink-0 text-[#5f656b]" aria-label={label} />{children}</p>
  );
  const dash = <span className="text-[#5f656b]">—</span>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Compare trips</h1>
        {!deps || (!isLoading && !n) ? <p className="mt-10" data-testid="compare-empty">Nothing to compare yet. <Link to="/search" className="text-coral underline">Pick up to 4 trips</Link>.</p> : (
          <div className="-mx-4 mt-8 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0" data-testid="compare-table">
            {/* one grid for all the cards, each spanning its rows, so each fact sits level with the same fact next door */}
            <div className="grid gap-x-4 gap-y-2.5" style={cols}>
              {items.map(({ card, dates = [] }) => {
                const types = (card.categories || []).filter((c) => STYLES[c]).map((c) => STYLES[c].label.replace(/ & .*/, ""));
                const others = dates.filter((d) => !ids.includes(d.dep_id));
                const { instagram, instagram_followers: f } = card.op;
                const tripLink = `/trip/${card.trip_id}?dep=${encodeURIComponent(card.dep_id)}`;
                const gst = card.gst_extra ? "+ GST" : card.breakdown?.find((l) => l.key === "taxes")?.status === "included" ? "incl. GST" : "";
                return (
                  <article key={card.dep_id} className="relative grid snap-start grid-rows-subgrid rounded-[22px] bg-card p-3 pb-4 text-[15px] text-[#16181b] shadow-soft" style={{ gridRow: `span ${rows}` }} data-testid={`compare-card-${card.dep_id}`}>
                    <div>
                      <TripPhoto src={card.image} dest={card.dest_slug} seed={card.trip_id} className="h-28 w-full rounded-2xl object-cover" />
                      <button onClick={() => remove(card.dep_id)} data-testid={`compare-remove-${card.dep_id}`} aria-label={`Remove ${card.title}`}
                        className="absolute right-5 top-5 grid h-7 w-7 place-items-center rounded-full bg-[#fffdf9]/95 shadow-[0_2px_4px_rgba(0,0,0,.18)] hover:bg-white"><X size={14} /></button>
                      <Link to={tripLink} className="mt-2.5 line-clamp-2 px-1 font-display text-[17px] leading-snug hover:underline">{card.title}</Link>
                    </div>
                    <div className="px-1"><Fact icon={Compass} label="Type">{types.length ? types.join(" · ") : dash}</Fact></div>
                    <div className="px-1" data-testid="card-price"><Fact icon={Tag} label="Price">
                      <span>{card.price_from && "from "}<b className="font-semibold">{fmt(card.price, card)}</b>{gst && <span className="text-[#5f656b]"> {gst}</span>}</span>
                    </Fact></div>
                    <div className="px-1"><Fact icon={CalendarDays} label="Dates">
                      <span>
                        {fmtRange(card.start, card.end)}
                        {others.length > 0 && (
                          // the trip's other dates: picking one switches this card to it
                          <label className="relative ml-1.5 inline-flex cursor-pointer items-center text-[14px] font-medium text-coral">
                            +{others.length} <ChevronDown size={13} />
                            <select aria-label={`Other dates for ${card.title}`} data-testid={`compare-dates-${card.dep_id}`} value=""
                              onChange={(e) => { const to = others.find((d) => d.dep_id === e.target.value); if (to) switchDate(card.dep_id, to); }}
                              className="absolute inset-0 cursor-pointer opacity-0">
                              <option value="" disabled>Switch to another date</option>
                              {others.map((d) => <option key={d.dep_id} value={d.dep_id}>{fmtRange(d.start, d.end)} · {d.price_from ? "from " : ""}{fmt(d.price, card)}</option>)}
                            </select>
                          </label>
                        )}
                      </span>
                    </Fact></div>
                    {/* seats: what the operator publishes; else the group size their page states (a booking system's seat count isn't one) */}
                    {anySeats && <div className="px-1" data-testid="compare-seats"><Fact icon={Users} label="Seats">{card.seats_left != null ? (card.seats_left === 0 ? "Full" : `${card.seats_left} seats left`)
                      : card.max_group != null ? (card.min_group != null ? `Groups of ${card.min_group}–${card.max_group}` : `Groups of up to ${card.max_group}`) : dash}</Fact></div>}
                    <div className="px-1"><Fact icon={Store} label="Who runs it">
                      <span className="min-w-0">{card.op.name}{instagram && f != null && <a href={`https://www.instagram.com/${instagram.replace("@", "")}/`} target="_blank" rel="noreferrer" className="whitespace-nowrap text-[#5f656b] hover:text-coral" title={`${f.toLocaleString("en-IN")} followers on Instagram`}> · <Instagram size={12} className="inline -mt-0.5" aria-label="Instagram followers" /> {compact(f)}</a>}</span>
                    </Fact></div>
                    <div className="px-1 pt-1"><Link to={tripLink} className="block rounded-full bg-coral py-2 text-center text-[14px] font-medium text-white hover:opacity-90">See trip</Link></div>
                  </article>
                );
              })}
            </div>

            {maxDays > 0 && (
              <button type="button" onClick={() => setShowDays((v) => !v)} aria-expanded={showDays} data-testid="compare-days-toggle"
                className={`mt-6 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] font-medium ${showDays ? "border-coral bg-coral text-white" : "border-[#d9cfbd] bg-[#fffdf9] hover:border-coral"}`}>
                Compare day by day <ChevronDown size={15} className={showDays ? "rotate-180" : ""} />
              </button>
            )}

            {showDays && (
              <div className="mt-4 grid gap-x-4" style={cols} data-testid="compare-days">
                {key && items.map(({ card }, ti) => (
                  <p key={`key-${card.dep_id}`} className="pb-3 text-[14px]" data-testid="compare-reach">
                    <mark className="rounded-[3px] bg-[#f6e3a1] px-0.5 text-inherit">{key.name}</mark>{" "}
                    {key.days[ti].length ? <b className="font-semibold">Day {key.days[ti][0]}</b> : <span className="text-[#5f656b]">—</span>}
                  </p>
                ))}
                {[...Array(maxDays)].flatMap((_, i) => items.map(({ card }, ti) => {
                  const d = daysOf[ti][i];
                  const note = daysOf[ti].length ? (i === daysOf[ti].length ? "Trip ends" : "") : i === 0 ? "No day-by-day listed" : "";
                  // past a shorter trip's end the cell stays empty, so the columns stay in line
                  if (!d && !note) return <div key={`${card.dep_id}-${i}`} aria-hidden />;
                  return (
                    <div key={`${card.dep_id}-${i}`} className="border-t border-[#e7dece] py-2.5 text-[14px] leading-snug">
                      <span className="text-[12px] text-[#5f656b]">Day {i + 1}</span>
                      <p>{d ? markPlaces(d.title, key ? [key.key] : []).map((x, k) => (x.key
                        ? <mark key={k} className="rounded-[3px] bg-[#f6e3a1] px-0.5 text-inherit">{x.text}</mark> : <span key={k}>{x.text}</span>))
                        : <span className="text-[#5f656b]">{note}</span>}</p>
                    </div>
                  );
                }))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

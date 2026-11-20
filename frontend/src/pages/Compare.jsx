import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Price } from "@/components/DepartureCard";
import { GenderBar, AgeBar, VerifiedStamp, lineIcon, lineNote } from "@/components/TripBits";
import { useApp } from "@/context/AppState";
import { http } from "@/lib/api";
import { LABELS } from "@/lib/constants";
import { fmtRange, money } from "@/lib/format";
import TripPhoto from "@/components/TripPhoto";


export default function Compare() {
  const [sp, setSp] = useSearchParams();
  const { compare, setCompare, currency } = useApp();
  const deps = sp.get("deps") || "";
  // the table is the trips in the address (a shared link works the same for everyone); removing one takes it out of
  // the address, and out of your own tray if it's there; it never adds anything to the tray
  const remove = (depId) => {
    const left = deps.split(",").filter((d) => d && d !== depId);
    setSp(left.length ? { deps: left.join(",") } : {}, { replace: true });
    if (compare.some((c) => c.dep_id === depId)) setCompare(compare.filter((c) => c.dep_id !== depId));
  };
  const fmt = (n) => money(n, currency, true);
  const startsFrom = (card) => (card.starts_from
    ? `${card.starts_from}${card.starts_from_how === "included" ? " (travel from there included)" : " (per the trip's name)"}`
    : card.meeting_point || "—");
  const { data, isLoading } = useQuery({ queryKey: ["compare", deps], queryFn: () => http.get(`/compare?deps=${encodeURIComponent(deps)}`).then((r) => r.data), enabled: !!deps });
  const items = data?.items || [];
  // the "best" badge weighs rating against price per day, so it is only shown when every trip has a rating
  const score = (x) => (x.card.rating / 5) / (x.card.true_price / x.card.duration);
  const best = items.length && items.every((x) => x.card.rating != null) ? items.reduce((a, b) => (score(b) > score(a) ? b : a)).card.dep_id : null;
  const maxDays = Math.max(0, ...items.map((x) => x.trip.itinerary_days.length));
  // only rows that say something: a row shows when at least one of the trips has a value for it
  const anyStart = items.some(({ card }) => card.starts_from || card.meeting_point);
  // GST isn't a row of its own: the price row already says when 5% GST is added
  const knownLines = (items[0]?.card.breakdown || []).map((l, idx) => [l, idx])
    .filter(([l, idx]) => l.key !== "taxes" && items.some(({ card }) => card.breakdown[idx]?.status !== "unknown"));
  const anyCancellation = items.some(({ trip }) => trip?.cancellation_policy);
  // the row names stay at the left and the trips stay at the top while the table scrolls, so on a phone you always know
  // which column is which; the name column is narrow there
  const Row = ({ label, children }) => (
    <tr className="border-t align-top"><th scope="row" className="sticky left-0 z-10 w-24 bg-card p-3 text-left text-[11px] font-semibold uppercase tracking-[.08em] text-[#5f656b] sm:w-40 sm:p-4 sm:text-xs">{label}</th>{children}</tr>
  );
  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Compare departures</h1>
        <p className="mt-2 text-muted-foreground">Side by side, using what each operator publishes. Anything none of them list is left out, so check the rest with the operator.</p>
        {!deps || (!isLoading && !items.length) ? <p className="mt-10" data-testid="compare-empty">Nothing to compare yet. <Link to="/search" className="underline">Pick up to 4 departures</Link>.</p> : (
          <div className="mt-8 max-h-[80vh] overflow-auto rounded-[28px] bg-card shadow-soft" data-testid="compare-table">
            <table className="w-full min-w-[560px] text-sm sm:min-w-[760px]">
              <thead className="sticky top-0 z-20 bg-card shadow-[0_1px_0_#e7dece]"><tr><th className="sticky left-0 z-30 bg-card" />
                {items.map(({ card }) => (
                  <th key={card.dep_id} scope="col" className={`min-w-[150px] bg-card p-3 text-left align-top sm:p-4 ${card.dep_id === best ? "bg-mint/10" : ""}`}>
                    {card.dep_id === best && <span className="chip mb-2 bg-mint text-white" data-testid="compare-best-badge"><Trophy size={12} /> Best for you · value & rating</span>}
                    <TripPhoto src={card.image} dest={card.dest_slug} className="hidden h-28 w-full rounded-2xl object-cover sm:block" />
                    <Link to={`/trip/${card.trip_id}?dep=${encodeURIComponent(card.dep_id)}`} className="mt-2 block font-display text-base leading-snug hover:underline sm:text-lg">{card.title}</Link>
                    <p className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{card.op.name} <VerifiedStamp status={card.op.verified_status} small /></p>
                    <button onClick={() => remove(card.dep_id)} data-testid={`compare-remove-${card.dep_id}`} className="mt-1 text-xs font-normal text-coral underline">Remove</button>
                  </th>
                ))}</tr></thead>
              <tbody>
                <Row label="Price">{items.map(({ card }) => <td key={card.dep_id} className="p-4"><Price card={card} /></td>)}</Row>
                <Row label="Dates">{items.map(({ card }) => <td key={card.dep_id} className="p-4">{fmtRange(card.start, card.end)} · {card.duration}D<br /><span className="text-muted-foreground">{card.seats_left != null ? `${card.seats_left} seats left` : ""}</span></td>)}</Row>
                {anyStart && <Row label="Starts from">{items.map(({ card }) => <td key={card.dep_id} className="p-4">{startsFrom(card)}</td>)}</Row>}
                <Row label="Group">{items.map(({ card }) => <td key={card.dep_id} className="space-y-2 p-4"><p>{LABELS.gender[card.gender_policy]}{card.max_group != null ? ` · ${card.min_group != null ? `${card.min_group}–` : "up to "}${card.max_group} people` : ""}{card.solo_ratio != null ? ` · ${Math.round(card.solo_ratio * 100)}% solo` : ""}</p><GenderBar split={card.gender_split} /><AgeBar range={card.age_range} median={card.age_median} /></td>)}</Row>
                {/* stay type is only known for hand-entered trips; imported ones show it under the checklist below */}
                {items.some(({ trip }) => trip.stay_tier) && <Row label="Stay type">{items.map(({ card, trip }) => <td key={card.dep_id} className="p-4">{trip.stay_tier ? `${LABELS.stay[trip.stay_tier]} · ${trip.room_sharing}` : "—"}</td>)}</Row>}
                {knownLines.map(([l, idx]) => (
                  <Row key={l.key} label={l.label}>{items.map(({ card }) => {
                    const line = card.breakdown[idx];
                    return <td key={card.dep_id} className="p-4 text-center">{line.status === "unknown"
                      ? <span className="text-[#5f656b]">—</span>
                      : <><span className="inline-flex">{lineIcon(line.status, 16)}</span><span className="block text-xs text-[#5f656b]">{lineNote(line, fmt)}</span></>}</td>;
                  })}</Row>
                ))}
                {anyCancellation && <Row label="Cancellation">{items.map(({ card, trip }) => <td key={card.dep_id} className="p-4 text-xs">{trip.cancellation_policy || "—"}</td>)}</Row>}
                {[...Array(maxDays)].map((_, i) => (
                  <Row key={i} label={`Day ${i + 1}`}>{items.map(({ card, trip }) => <td key={card.dep_id} className="p-4 text-xs">{trip.itinerary_days[i]?.title || "—"}</td>)}</Row>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

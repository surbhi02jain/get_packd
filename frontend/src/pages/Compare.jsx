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
import { fmtRange, short } from "@/lib/format";


export default function Compare() {
  const [sp] = useSearchParams();
  const { toggleCompare } = useApp();
  const deps = sp.get("deps") || "";
  const { data, isLoading } = useQuery({ queryKey: ["compare", deps], queryFn: () => http.get(`/compare?deps=${encodeURIComponent(deps)}`).then((r) => r.data), enabled: !!deps });
  const items = data?.items || [];
  // the "best" badge weighs rating against price per day, so it is only shown when every trip has a rating
  const score = (x) => (x.card.rating / 5) / (x.card.true_price / x.card.duration);
  const best = items.length && items.every((x) => x.card.rating != null) ? items.reduce((a, b) => (score(b) > score(a) ? b : a)).card.dep_id : null;
  const maxDays = Math.max(0, ...items.map((x) => x.trip.itinerary_days.length));
  const Row = ({ label, children }) => (
    <tr className="border-t align-top"><th className="sticky left-0 z-10 w-40 bg-card p-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</th>{children}</tr>
  );
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Compare departures</h1>
        <p className="mt-2 text-muted-foreground">Side by side, using what each operator publishes. Where we couldn't read something from the listing, it says to check with the operator.</p>
        {!deps || (!isLoading && !items.length) ? <p className="mt-10" data-testid="compare-empty">Nothing to compare yet. <Link to="/search" className="underline">Pick up to 4 departures</Link>.</p> : (
          <div className="mt-8 overflow-x-auto rounded-[28px] bg-card shadow-soft" data-testid="compare-table">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr><th className="sticky left-0 z-10 bg-card" />
                {items.map(({ card }) => (
                  <th key={card.dep_id} className={`p-4 text-left align-top ${card.dep_id === best ? "bg-mint/10" : ""}`}>
                    {card.dep_id === best && <span className="chip mb-2 bg-mint text-white" data-testid="compare-best-badge"><Trophy size={12} /> Best for you · value & rating</span>}
                    <img src={card.image} alt="" className="h-28 w-full rounded-2xl object-cover" />
                    <Link to={`/trip/${card.trip_id}?dep=${encodeURIComponent(card.dep_id)}`} className="mt-2 block font-display text-lg leading-snug hover:underline">{card.title}</Link>
                    <p className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{card.op.name} <VerifiedStamp status={card.op.verified_status} small /></p>
                    <button onClick={() => toggleCompare(card)} className="mt-1 text-xs font-normal underline">remove from tray</button>
                  </th>
                ))}</tr></thead>
              <tbody>
                <Row label="Price">{items.map(({ card }) => <td key={card.dep_id} className="p-4"><Price card={card} /></td>)}</Row>
                <Row label="Dates">{items.map(({ card }) => <td key={card.dep_id} className="p-4">{fmtRange(card.start, card.end)} · {card.duration}D<br /><span className="text-muted-foreground">{card.seats_left != null ? `${card.seats_left} seats left` : ""}</span></td>)}</Row>
                <Row label="Meeting point">{items.map(({ card }) => <td key={card.dep_id} className="p-4">{card.meeting_point || "—"}</td>)}</Row>
                <Row label="Group">{items.map(({ card }) => <td key={card.dep_id} className="space-y-2 p-4"><p>{LABELS.gender[card.gender_policy]}{card.max_group != null ? ` · ${card.min_group != null ? `${card.min_group}–` : "up to "}${card.max_group} people` : ""}{card.solo_ratio != null ? ` · ${Math.round(card.solo_ratio * 100)}% solo` : ""}</p><GenderBar split={card.gender_split} /><AgeBar range={card.age_range} median={card.age_median} /></td>)}</Row>
                {/* stay type is only known for hand-entered trips; imported ones show it under the checklist below */}
                {items.some(({ trip }) => trip.stay_tier) && <Row label="Stay type">{items.map(({ card, trip }) => <td key={card.dep_id} className="p-4">{trip.stay_tier ? `${LABELS.stay[trip.stay_tier]} · ${trip.room_sharing}` : "—"}</td>)}</Row>}
                {items[0]?.card.breakdown.map((l, idx) => (
                  <Row key={l.key} label={l.label}>{items.map(({ card }) => <td key={card.dep_id} className="p-4 text-center"><span className="inline-flex">{lineIcon(card.breakdown[idx].status, 16)}</span><span className="block font-mono text-[10px] text-muted-foreground">{lineNote(card.breakdown[idx], short)}</span></td>)}</Row>
                ))}
                <Row label="Cancellation">{items.map(({ card, trip }) => <td key={card.dep_id} className="p-4 text-xs">{trip.cancellation_policy || (trip.url ? <a href={trip.url} target="_blank" rel="noreferrer" className="underline">See operator's page</a> : "—")}</td>)}</Row>
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

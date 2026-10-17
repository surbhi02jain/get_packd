import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Star, Globe2, Instagram } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DepartureCard from "@/components/DepartureCard";
import { VerifiedStamp, followerNote } from "@/components/TripBits";
import { CompareTray } from "@/components/Overlays";
import { SampleBadge } from "@/components/Motion";
import { http } from "@/lib/api";
import { LABELS } from "@/lib/constants";
import { compact } from "@/lib/format";

const CHECKS = [["registration", "Business registration checked"], ["gst", "GST number verified"], ["leaders_checked", "Trip leaders background-checked"], ["refund_history", "Clean refund history"]];

export default function Operator() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ["op", id], queryFn: () => http.get(`/operators/${id}`).then((r) => r.data) });
  if (isLoading || !data) return <div className="min-h-screen"><Navbar /><div className="shimmer m-8 h-64 rounded-[28px]" /></div>;
  const { operator: op, departures, reviews } = data;
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-10 sm:px-8">
        <section className="relative overflow-hidden rounded-[32px] bg-midnight p-8 text-sand grain sm:p-12" data-testid="operator-header">
          <div className="relative z-10 flex flex-wrap items-start gap-6">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-coral font-display text-3xl font-bold">{op.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">{op.trips_imported !== false && <SampleBadge />}<span className="label-mono !text-amber">{LABELS.op_type[op.category]}</span></div>
              <h1 className="mt-2 font-display text-4xl sm:text-5xl" data-testid="operator-name">{op.name}</h1>
              {op.bio && <p className="mt-2 max-w-2xl text-sand/75">{op.bio}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <VerifiedStamp status={op.verified_status} />
                {op.years_active != null && <span>{op.years_active} years active</span>}
                {op.rating != null && <span className="flex items-center gap-1"><Star size={14} className="fill-amber text-amber" /> {op.rating} · {op.review_count} reviews</span>}
                {op.website && <a href={op.website} target="_blank" rel="noreferrer" data-testid="operator-website" className="flex items-center gap-1 underline"><Globe2 size={14} /> {op.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>}
                {op.instagram && <a href={`https://www.instagram.com/${op.instagram.replace("@", "")}/`} target="_blank" rel="noreferrer" data-testid="operator-instagram" className="flex items-center gap-1 underline"><Instagram size={14} /> {op.instagram}</a>}
                {op.instagram_followers != null && <span data-testid="operator-instagram-followers" title="A sign of audience size, not a rating."><b>{compact(op.instagram_followers)}</b> Instagram followers{followerNote(op.instagram_followers_at, op.instagram_followers_source) ? ` · ${followerNote(op.instagram_followers_at, op.instagram_followers_source)}` : ""}</span>}
              </div>
            </div>
          </div>
        </section>
        {op.source === "import" && (
          <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground" data-testid="operator-listing-note">
            {op.trips_imported
              ? `Wayfind lists ${op.name} and reads its trips, dates and prices from its own website. We haven't vetted or rated this operator — check the details on their site before booking.`
              : `${op.name} is on Wayfind's operator list, but we haven't read its trips yet. We haven't vetted or rated this operator.`}
          </p>
        )}
        {op.source !== "import" && <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-[28px] bg-card p-6 shadow-soft" data-testid="operator-verification">
            <h2 className="font-display text-2xl">Verification checklist</h2>
            <ul className="mt-4 space-y-3">
              {CHECKS.map(([k, l]) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  {op.verification?.[k] ? <span className="grid h-6 w-6 place-items-center rounded-full bg-mint/15 text-mint"><Check size={14} /></span> : <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-muted-foreground"><X size={14} /></span>}{l}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[28px] bg-card p-6 shadow-soft" data-testid="operator-leaders">
            <h2 className="font-display text-2xl">Trip leaders</h2>
            <div className="mt-4 space-y-3">
              {op.leaders.map((l, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border p-3 text-sm">
                  <span><b>{l.name}</b> {l.gender === "female" && <span className="stamp ml-2 border-coral text-coral">Women leader</span>}</span>
                  <span className="text-muted-foreground">{l.years} yrs · {l.trips_led} trips</span>
                </div>
              ))}
            </div>
          </section>
        </div>}
        <section>
          <h2 className="font-display text-3xl">Upcoming departures <span className="text-muted-foreground">({departures.length})</span></h2>
          {departures.length === 0 && <p className="mt-4 text-muted-foreground" data-testid="operator-no-departures">We don't have this operator's departures yet. {op.website && <a href={op.website} target="_blank" rel="noreferrer" className="underline">See their trips on their website.</a>}</p>}
          <div className="mt-5 space-y-5">{departures.slice(0, 12).map((c) => <DepartureCard key={c.dep_id} card={c} />)}</div>
          {departures.length > 12 && <Link to={`/search?operator=${op.id}`} className="mt-4 inline-block underline" data-testid="operator-see-all">See all {departures.length} departures</Link>}
        </section>
        {reviews.length > 0 && <section className="rounded-[28px] bg-card p-6 shadow-soft">
          <h2 className="font-display text-2xl">Reviews</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => <div key={r.id} className="rounded-2xl border p-4 text-sm"><p className="font-semibold">{r.author} · ★ {r.rating}</p><p className="mt-1 text-muted-foreground">{r.text}</p></div>)}
          </div>
        </section>}
      </main>
      <CompareTray />
      <Footer />
    </div>
  );
}

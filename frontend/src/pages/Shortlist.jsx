import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, ThumbsDown, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DepartureCard from "@/components/DepartureCard";
import { CompareTray } from "@/components/Overlays";
import { useApp } from "@/context/AppState";
import { http } from "@/lib/api";
import { fmtRange, short } from "@/lib/format";

export function Shortlist() {
  const { hearts } = useApp();
  const [link, setLink] = useState(null);
  const ids = hearts.join(",");
  const { data, isLoading } = useQuery({ queryKey: ["deps", ids], queryFn: () => http.get(`/departures?ids=${encodeURIComponent(ids)}`).then((r) => r.data), enabled: !!ids });
  const share = async () => {
    const { data: r } = await http.post("/shortlists", { dep_ids: hearts });
    const url = `${window.location.origin}/s/${r.id}`;
    setLink(url);
    navigator.clipboard?.writeText(url).catch(() => {});
    toast.success("Share link created & copied");
  };
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-4xl sm:text-5xl">Your shortlist</h1><p className="mt-2 text-muted-foreground">Saved on this device. Share it and let friends vote.</p></div>
          {hearts.length > 0 && <button data-testid="shortlist-share-button" onClick={share} className="flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 font-semibold text-white"><Share2 size={16} /> Share with friends</button>}
        </div>
        {link && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-dashed border-coral/50 p-3 text-sm" data-testid="shortlist-share-link">
            <span className="truncate font-mono">{link}</span>
            <button onClick={() => navigator.clipboard?.writeText(link)} aria-label="Copy"><Copy size={15} /></button>
            <Link to={link.replace(window.location.origin, "")} className="ml-auto font-semibold underline">Open</Link>
          </div>
        )}
        <div className="mt-8 space-y-5">
          {!hearts.length && <p data-testid="shortlist-empty">Tap the heart on any departure to save it here. <Link to="/search" className="underline">Browse trips</Link></p>}
          {isLoading && <div className="shimmer h-56 rounded-[24px]" />}
          {data?.items.map((c) => <div key={c.dep_id} data-testid={`shortlist-card-${c.dep_id}`}><DepartureCard card={c} /></div>)}
        </div>
      </main>
      <CompareTray />
      <Footer />
    </div>
  );
}

export function SharedShortlist() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [voter, setVoter] = useState(() => localStorage.getItem("wf_voter") || "");
  useEffect(() => { if (voter) localStorage.setItem("wf_voter", voter); }, [voter]);
  const { data, isLoading, isError } = useQuery({ queryKey: ["sl", id], queryFn: () => http.get(`/shortlists/${id}`).then((r) => r.data) });
  const vote = async (dep, v) => {
    if (!voter.trim()) return toast.error("Add your name first so friends know who voted");
    const key = dep.replace(/\./g, "_");
    const mine = data.shortlist.votes?.[key]?.[voter.replace(/[^a-zA-Z0-9_-]/g, "")];
    const { data: r } = await http.post(`/shortlists/${id}/vote`, { dep_id: dep, voter, vote: mine === v ? "none" : v });
    qc.setQueryData(["sl", id], r);
  };
  if (isError) return <div className="min-h-screen"><Navbar /><p className="p-20 text-center">Shortlist not found.</p></div>;
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
        <p className="label-mono">Shared shortlist</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">{data?.shortlist.name || "…"}</h1>
        <input data-testid="voter-name-input" value={voter} onChange={(e) => setVoter(e.target.value)} placeholder="Your name (to vote)" className="mt-5 w-full max-w-xs rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-coral" />
        <div className="mt-6 space-y-4">
          {isLoading && <div className="shimmer h-32 rounded-[24px]" />}
          {data?.items.map((c) => {
            const v = data.shortlist.votes?.[c.dep_id.replace(/\./g, "_")] || {};
            const ups = Object.entries(v).filter(([, x]) => x === "up"), downs = Object.entries(v).filter(([, x]) => x === "down");
            return (
              <div key={c.dep_id} className="flex flex-col gap-4 rounded-[24px] bg-card p-4 shadow-soft sm:flex-row sm:items-center" data-testid={`shared-item-${c.dep_id}`}>
                <img src={c.image} alt="" className="h-24 w-full rounded-2xl object-cover sm:w-36" />
                <div className="min-w-0 flex-1">
                  <Link to={`/trip/${c.trip_id}?dep=${encodeURIComponent(c.dep_id)}`} className="font-display text-xl hover:underline">{c.title}</Link>
                  <p className="text-sm text-muted-foreground">{c.op.name} · {fmtRange(c.start, c.end)} · <b className="text-foreground">{short(c.true_price)}</b> true price</p>
                  {(ups.length > 0 || downs.length > 0) && <p className="mt-1 text-xs text-muted-foreground">{ups.map(([n]) => n).join(", ")}{ups.length ? " liked" : ""}{downs.length ? ` · ${downs.map(([n]) => n).join(", ")} passed` : ""}</p>}
                </div>
                <div className="flex gap-2">
                  <button data-testid={`vote-up-${c.dep_id}`} onClick={() => vote(c.dep_id, "up")} className="flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-semibold hover:border-mint hover:text-mint"><ThumbsUp size={15} /> {ups.length}</button>
                  <button data-testid={`vote-down-${c.dep_id}`} onClick={() => vote(c.dep_id, "down")} className="flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-semibold hover:border-coral hover:text-coral"><ThumbsDown size={15} /> {downs.length}</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}

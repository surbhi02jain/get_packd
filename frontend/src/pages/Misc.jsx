import { useState } from "react";
import { Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { BadgeIndianRupee, CalendarRange, Megaphone, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { http, qs } from "@/lib/api";
import { LABELS } from "@/lib/constants";

const inp = "w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-coral";

export function ListDepartures() {
  const [f, setF] = useState({ company: "", contact_name: "", email: "", phone: "", website: "", category: "community", departures_per_year: "", message: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await http.post("/operator-signups", { ...f, departures_per_year: f.departures_per_year ? +f.departures_per_year : null });
      setDone(true); confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, disableForReducedMotion: true });
    } catch { toast.error("Please fill all required fields"); }
    setBusy(false);
  };
  const props = [[BadgeIndianRupee, "Pay per lead", "Only pay when a real traveller enquires. No 15–20% commission on bookings."], [CalendarRange, "Free departure calendar", "List every fixed departure with dates, seats and itinerary — free."], [Megaphone, "Reach the right travellers", "Solo women, 60+, friends, families — matched by group fit, not ad spend."]];
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto grid max-w-[1300px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="label-mono">For Indian operators</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl lg:text-6xl">List your departures. <span className="italic text-coral">Keep your margins.</span></h1>
          <p className="mt-4 max-w-lg text-muted-foreground">getPackd shows every group departure in one place. Travellers enquire with you directly — we never sit between you and your customer.</p>
          <div className="mt-8 space-y-4">
            {props.map(([I, t, s]) => <div key={t} className="flex gap-4 rounded-[24px] bg-card p-5 shadow-soft"><I className="shrink-0 text-coral" /><div><p className="font-display text-xl">{t}</p><p className="text-sm text-muted-foreground">{s}</p></div></div>)}
          </div>
        </div>
        <div className="rounded-[28px] bg-card p-6 shadow-lift sm:p-8">
          {done ? <div className="py-16 text-center" data-testid="signup-success"><p className="font-display text-3xl">Welcome aboard!</p><p className="mt-2 text-muted-foreground">We'll verify your registration and GST, then set up your departure calendar.</p></div> : (
            <form onSubmit={submit} className="space-y-3" data-testid="operator-signup-form">
              <p className="font-display text-2xl">Get listed</p>
              <input required data-testid="signup-company" className={inp} placeholder="Company name" value={f.company} onChange={set("company")} />
              <input required data-testid="signup-contact" className={inp} placeholder="Your name" value={f.contact_name} onChange={set("contact_name")} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input required type="email" data-testid="signup-email" className={inp} placeholder="Email" value={f.email} onChange={set("email")} />
                <input required data-testid="signup-phone" className={inp} placeholder="Phone" value={f.phone} onChange={set("phone")} />
              </div>
              <input data-testid="signup-website" className={inp} placeholder="Website or Instagram" value={f.website} onChange={set("website")} />
              <div className="grid gap-3 sm:grid-cols-2">
                <select data-testid="signup-category" className={inp} value={f.category} onChange={set("category")}>{Object.entries(LABELS.op_type).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input type="number" data-testid="signup-departures" className={inp} placeholder="Departures / year" value={f.departures_per_year} onChange={set("departures_per_year")} />
              </div>
              <textarea data-testid="signup-message" rows={3} className={inp} placeholder="Tell us about your trips" value={f.message} onChange={set("message")} />
              <button data-testid="signup-submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 font-semibold text-white">{busy && <Loader2 size={16} className="animate-spin" />} Request listing</button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function Alerts() {
  const [email, setEmail] = useState(() => localStorage.getItem("wf_email") || "");
  const [items, setItems] = useState(null);
  const load = async () => { const { data } = await http.get(`/alerts?email=${encodeURIComponent(email)}`); setItems(data.items); localStorage.setItem("wf_email", email); };
  const del = async (id) => { await http.delete(`/alerts/${id}`); setItems(items.filter((x) => x.id !== id)); };
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[900px] px-4 py-12 sm:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Your alerts</h1>
        <p className="mt-2 text-muted-foreground">“Notify me” saved searches for new departures and price drops (email only). Save one from any results page.</p>
        <div className="mt-6 flex gap-2">
          <input data-testid="alerts-email-input" className={inp} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button data-testid="alerts-load-button" onClick={load} className="rounded-2xl bg-midnight px-6 font-semibold text-sand dark:bg-sand dark:text-midnight">Show</button>
        </div>
        <div className="mt-6 space-y-3">
          {items && !items.length && <p data-testid="alerts-empty">No alerts for this email yet.</p>}
          {items?.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-[22px] bg-card p-4 shadow-soft" data-testid={`alert-item-${a.id}`}>
              <div className="min-w-0"><p className="font-semibold">{a.label}</p><p className="truncate font-mono text-xs text-muted-foreground">{Object.entries(a.filters).map(([k, v]) => `${k}=${v}`).join(" · ") || "Anywhere"}</p></div>
              <span className="shrink-0 text-sm"><b>{a.matches_now}</b> matching</span>
              <Link to={`/search?${qs(a.filters)}`} className="shrink-0 text-sm underline">Open</Link>
              <button data-testid={`alert-delete-${a.id}`} onClick={() => del(a.id)} aria-label="Delete"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

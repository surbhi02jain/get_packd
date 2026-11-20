import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppState";
import confetti from "canvas-confetti";
import { BadgeIndianRupee, CalendarRange, Megaphone, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { http, qs, errorText } from "@/lib/api";
import { LABELS } from "@/lib/constants";

const inp = "w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-coral";

/** A form field with its name above it, so the label stays once something is typed (a placeholder alone disappears). */
const Labeled = ({ label, optional, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-[#5f656b]">{label}{optional && <span className="font-normal"> (optional)</span>}</span>
    {children}
  </label>
);

// what the form checks before sending; the API checks the same again
function signupProblem(f) {
  if (f.company.trim().length < 2) return "Add your company name";
  if (f.contact_name.trim().length < 2) return "Add your name";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return "That email doesn't look right";
  if (!/^\+?[\d\s()-]{7,20}$/.test(f.phone.trim()) || (f.phone.match(/\d/g) || []).length < 7) return "That phone number doesn't look right";
  if (f.departures_per_year !== "" && (+f.departures_per_year < 0 || !Number.isInteger(+f.departures_per_year))) return "Departures a year should be a whole number, 0 or more";
  return null;
}

export function ListDepartures() {
  const [f, setF] = useState({ company: "", contact_name: "", email: "", phone: "", website: "", category: "community", departures_per_year: "", message: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const problem = signupProblem(f);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      await http.post("/operator-signups", { ...f, departures_per_year: f.departures_per_year !== "" ? +f.departures_per_year : null });
      setDone(true); confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, disableForReducedMotion: true });
    } catch (err) { toast.error(errorText(err, "Couldn't send that. Try again in a moment.")); }
    setBusy(false);
  };
  const props = [[BadgeIndianRupee, "Pay per lead", "Only pay when a real traveller enquires. No 15–20% commission on bookings."], [CalendarRange, "Free departure calendar", "List every fixed departure with dates, seats and itinerary — free."], [Megaphone, "Reach the right travellers", "Solo women, 60+, friends, families — matched by group fit, not ad spend."]];
  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto grid max-w-[1300px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="label-mono">For Indian operators</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-[1.04] sm:text-5xl lg:text-6xl">List your departures. <span>Keep your margins.</span></h1>
          <p className="mt-4 max-w-lg text-muted-foreground">getPackd shows every group departure in one place. Travellers enquire with you directly — we never sit between you and your customer.</p>
          <div className="mt-8 space-y-4">
            {props.map(([I, t, s]) => <div key={t} className="flex gap-4 rounded-[24px] bg-card p-5 shadow-soft"><I className="shrink-0 text-[#16181b]" /><div><p className="font-display text-xl">{t}</p><p className="text-sm text-muted-foreground">{s}</p></div></div>)}
          </div>
        </div>
        <div className="rounded-[28px] bg-card p-6 shadow-lift sm:p-8">
          {done ? <div className="py-16 text-center" data-testid="signup-success"><p className="font-display text-3xl">Welcome aboard!</p><p className="mt-2 text-muted-foreground">We'll verify your registration and GST, then set up your departure calendar.</p></div> : (
            <form onSubmit={submit} className="space-y-3" data-testid="operator-signup-form">
              <p className="font-display text-2xl">Get listed</p>
              <Labeled label="Company name"><input required maxLength={120} autoComplete="organization" data-testid="signup-company" className={inp} value={f.company} onChange={set("company")} /></Labeled>
              <Labeled label="Your name"><input required maxLength={80} autoComplete="name" data-testid="signup-contact" className={inp} value={f.contact_name} onChange={set("contact_name")} /></Labeled>
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Email"><input required type="email" maxLength={200} autoComplete="email" data-testid="signup-email" className={inp} value={f.email} onChange={set("email")} /></Labeled>
                <Labeled label="Phone"><input required type="tel" maxLength={20} autoComplete="tel" data-testid="signup-phone" className={inp} value={f.phone} onChange={set("phone")} /></Labeled>
              </div>
              <Labeled label="Website or Instagram" optional><input maxLength={300} data-testid="signup-website" className={inp} value={f.website} onChange={set("website")} /></Labeled>
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Kind of operator"><select data-testid="signup-category" className={inp} value={f.category} onChange={set("category")}>{Object.entries(LABELS.op_type).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Labeled>
                <Labeled label="Departures a year" optional><input type="number" min={0} max={10000} step={1} data-testid="signup-departures" className={inp} value={f.departures_per_year} onChange={set("departures_per_year")} /></Labeled>
              </div>
              <Labeled label="Tell us about your trips" optional><textarea maxLength={2000} data-testid="signup-message" rows={3} className={inp} value={f.message} onChange={set("message")} /></Labeled>
              <button data-testid="signup-submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 font-semibold text-white">{busy && <Loader2 size={16} className="animate-spin" />} Request listing</button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Saved searches belong to your account (the API won't list or delete anyone's by their email alone)
export function Alerts() {
  const { user } = useApp();
  const { data, refetch } = useQuery({ queryKey: ["alerts", user?.id], queryFn: () => http.get("/alerts").then((r) => r.data.items), enabled: !!user });
  const del = async (id) => {
    try { await http.delete(`/alerts/${id}`); refetch(); } catch (e) { toast.error(errorText(e)); }
  };
  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto max-w-[900px] px-4 py-12 sm:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Your alerts</h1>
        <p className="mt-2 text-muted-foreground">“Notify me” saved searches for new departures and price drops. Save one from any results page.</p>
        {!user && <p className="mt-6" data-testid="alerts-login">Alerts are kept on your account. <Link to="/login" state={{ from: "/alerts" }} className="font-semibold text-coral underline">Log in</Link> to see yours.</p>}
        <div className="mt-6 space-y-3">
          {user && data && !data.length && <p data-testid="alerts-empty">No alerts yet.</p>}
          {data?.map((a) => (
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

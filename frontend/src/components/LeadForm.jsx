import { useState } from "react";
import confetti from "canvas-confetti";
import { Loader2, PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { http } from "@/lib/api";
import { fmtRange, short } from "@/lib/format";

export default function LeadForm({ open, onOpenChange, trip, departures, depId }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", party_size: 1, message: "" });
  const [dep, setDep] = useState(depId);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await http.post("/leads", { ...f, party_size: +f.party_size, dep_id: dep || depId, trip_id: trip.id });
      setDone(true);
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#FF6B4A", "#FFB547", "#10B981", "#FAF6EF"], disableForReducedMotion: true });
    } catch { toast.error("Please add your name and a valid phone number"); }
    setBusy(false);
  };
  const inp = "w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-coral";
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDone(false); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl" data-testid="lead-form-dialog">
        {done ? (
          <div className="py-8 text-center" data-testid="lead-success">
            <PartyPopper className="mx-auto text-coral" size={40} />
            <p className="mt-4 font-display text-3xl">Enquiry sent!</p>
            <p className="mt-2 text-sm text-muted-foreground">The operator usually replies within a day on WhatsApp or phone. No payment is taken on getPackd.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Enquire about this trip</DialogTitle>
              <DialogDescription>{trip.title} — goes straight to the operator. Free, no commission.</DialogDescription>
            </DialogHeader>
            <input required data-testid="lead-name" className={inp} placeholder="Your name" value={f.name} onChange={set("name")} />
            <input required data-testid="lead-phone" className={inp} placeholder="Phone / WhatsApp" value={f.phone} onChange={set("phone")} />
            <input data-testid="lead-email" type="email" className={inp} placeholder="Email (optional)" value={f.email} onChange={set("email")} />
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <select data-testid="lead-departure" className={inp} value={dep} onChange={(e) => setDep(e.target.value)}>
                {departures.filter((x) => x.status !== "cancelled").map((x) => <option key={x.dep_id} value={x.dep_id}>{fmtRange(x.start, x.end)} · {short(x.true_price)}</option>)}
              </select>
              <input data-testid="lead-party-size" type="number" min={1} max={20} className={inp} value={f.party_size} onChange={set("party_size")} title="Party size" />
            </div>
            <textarea data-testid="lead-message" className={inp} rows={3} placeholder="Anything the operator should know?" value={f.message} onChange={set("message")} />
            <button data-testid="lead-submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 font-semibold text-white transition-transform active:scale-95">
              {busy && <Loader2 size={16} className="animate-spin" />} Send enquiry
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

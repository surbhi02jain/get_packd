import { useState } from "react";
import confetti from "canvas-confetti";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { http } from "@/lib/api";
import { fmtRange, short } from "@/lib/format";
import { PassportStamp, PackingList, packingList } from "./Stamp";
import { inkColor } from "@/components/Ink";

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function LeadForm({ open, onOpenChange, trip, departures, depId, destination }) {
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
      // a short burst as the stamp lands
      setTimeout(() => confetti({ particleCount: 90, spread: 70, origin: { y: 0.45 }, colors: [inkColor(), "#c9302a", "#16181b", "#fffdf9"], disableForReducedMotion: true }), 250);
    } catch { toast.error("Please add your name and a valid phone number"); }
    setBusy(false);
  };
  const inp = "w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-coral";
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDone(false); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl" data-testid="lead-form-dialog">
        {done ? (() => {
          const chosen = departures.find((x) => x.dep_id === (dep || depId));
          const place = destination || chosen?.destination || trip.title;
          return (
            <div className="py-4 text-center" data-testid="lead-success">
              <PassportStamp destination={place} date={chosen?.start} />
              <p className="mt-2 font-display text-3xl">Enquiry sent!</p>
              <p className="mt-2 text-sm text-muted-foreground">The operator usually replies within a day on WhatsApp or phone. No payment is taken on getPackd.</p>
              <PackingList destination={place} month={chosen ? MONTH[+chosen.start.slice(5, 7) - 1] : null}
                items={packingList({ climate: trip.climate_tags, season: chosen?.season, intl: trip.domestic_or_international === "international" })} />
            </div>
          );
        })() : (
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

/** Shown when someone leaves for an operator's own site to book: a "bon voyage" stamp and a packing list to come back to. */
export function OffToOperator({ open, onOpenChange, trip, dep, destination, operator }) {
  const place = destination || dep?.destination || trip.title;
  const whose = /s$/i.test(operator) ? `${operator}'` : `${operator}'s`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl" data-testid="off-to-operator-dialog">
        {open && (
          <div className="py-4 text-center">
            <DialogHeader className="sr-only"><DialogTitle>Bon voyage</DialogTitle><DialogDescription>{whose} page opened in a new tab</DialogDescription></DialogHeader>
            <PassportStamp destination={place} date={dep?.start} rim="BON VOYAGE" />
            <p className="mt-2 font-display text-3xl">Bon voyage!</p>
            <p className="mt-2 text-sm text-muted-foreground">{whose} page is open in a new tab. You book with them directly; getPackd takes no commission.</p>
            <PackingList destination={place} month={dep ? MONTH[+dep.start.slice(5, 7) - 1] : null}
              items={packingList({ climate: trip.climate_tags, season: dep?.season, intl: trip.domestic_or_international === "international" })} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

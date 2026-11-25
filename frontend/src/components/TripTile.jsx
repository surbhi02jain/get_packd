import { Link } from "react-router-dom";
import { ArrowRightLeft, MapPin, Star } from "lucide-react";
import { useApp } from "@/context/AppState";
import { fmtRange, money } from "@/lib/format";
import { HeartButton } from "./HeartButton";
import TripPhoto from "./TripPhoto";

// A trip as a print taped into the travel journal: it sits straight in the grid (a whole page of tilted prints reads as
// clutter) and only tips a little under the pointer. The place is a tag on the photo; under it four short lines: what,
// who runs it and for how long, when, and the price in handwriting. At most one badge, only for what's worth stopping on.
const tiltOf = (id) => {
  const t = ((([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) % 7) + 7) % 7 - 3) * 0.4;
  return t === 0 ? -0.8 : t;
};

// who can go comes before how full it is: a women-only trip says so on its card, or a couple shortlists it unawares
function badgeFor(card, womenOnlyPage) {
  if (card.status === "cancelled") return "Cancelled";
  if (card.gender_policy === "women_only" && !womenOnlyPage) return "Women-only";
  if (card.fit_label) return card.fit_label;
  if (card.status === "filling") return "Filling fast";
  return null;
}
// prices are read again every 3 days; one we couldn't read for over a week says how old it is
export const STALE_DAYS = 7;

export default function TripTile({ card, cluster, showTrue = true, onHover, womenOnlyPage = false }) {
  const { compare, toggleCompare, currency } = useApp();
  const inCompare = compare.some((c) => c.dep_id === card.dep_id);
  const price = showTrue ? card.true_price : card.price;
  const more = cluster?.count > 1 ? cluster.count - 1 : 0;
  const badge = badgeFor(card, womenOnlyPage);
  const link = `/trip/${card.trip_id}?dep=${encodeURIComponent(card.dep_id)}`;

  return (
    <article data-testid={`departure-card-${card.dep_id}`} className={`group relative ${card.status === "cancelled" ? "opacity-60" : ""}`}
      onMouseEnter={() => onHover?.(card.dest_slug)} onMouseLeave={() => onHover?.(null)}>
      <Link to={link} className="block">
        <div className="relative rounded-[3px] bg-[#fffdf9] p-[7px] shadow-[0_1px_2px_rgba(60,45,20,.1),0_10px_18px_-10px_rgba(60,45,20,.35)] transition-[rotate] duration-300 group-hover:[rotate:var(--tilt)]"
          style={{ "--tilt": `${tiltOf(card.trip_id)}deg` }}>
          <span aria-hidden className="absolute -top-2.5 left-1/2 z-10 h-5 w-16 -translate-x-1/2 rotate-[3deg] bg-[#e9dfc6]/85 shadow-[0_1px_2px_rgba(0,0,0,.08)]" />
          <div className="relative aspect-[20/19] overflow-hidden rounded-[2px] bg-[#e7dece]">
            <TripPhoto src={card.image} dest={card.dest_slug} seed={card.trip_id} alt={card.destination} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            {badge && <span className="absolute left-3 top-3 rounded-full bg-[#fffdf9] px-3 py-1.5 text-[13px] font-semibold leading-none text-[#16181b] shadow-[0_2px_4px_rgba(0,0,0,.18)]">{badge}</span>}
            <span className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full bg-[#fffdf9]/95 px-2.5 py-1 text-[12.5px] font-medium leading-none text-[#16181b] shadow-[0_1px_3px_rgba(0,0,0,.15)]" data-testid="card-place">
              <MapPin size={12} className="shrink-0" /><span className="truncate">{card.destination}</span>
            </span>
          </div>
        </div>
        <div className="mt-3 text-[15px] leading-[20px]">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold text-[#16181b]">{card.title}</p>
            {card.rating != null && <p className="flex shrink-0 items-center gap-1 text-[#16181b]"><Star size={12} className="fill-[#16181b] text-[#16181b]" /> {card.rating}</p>}
          </div>
          <p className="truncate text-[#5b6066]">{card.op.name} · {card.duration} {card.duration === 1 ? "day" : "days"}</p>
          <p className="truncate text-[#5b6066]">{fmtRange(card.start, card.end)}{more > 0 && ` · +${more} more ${more === 1 ? "date" : "dates"}`}</p>
          <p className="mt-1.5 text-[#16181b]" data-testid="card-price">
            {/* "from": the operator gives only a starting price for this date */}
            {card.price_from && <span className="text-[#5b6066]">from </span>}<span className="font-['Caveat'] text-[24px] leading-none text-coral">{money(price, currency, card.dtype === "international")}</span> per person
            {/* written as the operator lists it: "₹9,400 per person + 5% GST" */}
            {card.gst_extra && <span className="text-[#5b6066]"> + 5% GST</span>}
          </p>
          {card.last_verified_days > STALE_DAYS && <p className="text-[13px] text-[#a3271f]" data-testid="card-stale">Price read {card.last_verified_days} days ago</p>}
        </div>
      </Link>
      <div className="absolute right-4 top-4 flex items-center gap-1">
        {/* an icon, not a word: a balance scale, "weigh them up"; filled indigo once picked. Its tooltip shows on hover and on keyboard focus */}
        <button data-testid={`compare-toggle-${card.dep_id}`} onClick={() => toggleCompare(card)} aria-pressed={inCompare}
          aria-label={inCompare ? `Remove ${card.title} from compare` : `Add ${card.title} to compare`}
          className={`group/cmp relative grid h-8 w-8 place-items-center rounded-full shadow-[0_2px_4px_rgba(0,0,0,.18)] transition-colors after:absolute after:-inset-1.5 after:content-[''] ${inCompare ? "bg-coral text-white" : "bg-[#fffdf9]/95 text-[#16181b] hover:bg-white"}`}>
          <ArrowRightLeft size={16} strokeWidth={2.2} aria-hidden />
          <span aria-hidden data-testid="compare-tooltip"
            className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-md bg-[#16181b] px-2.5 py-1.5 text-[12px] font-medium leading-none text-white opacity-0 shadow-[0_2px_6px_rgba(0,0,0,.25)] transition-opacity duration-150 group-hover/cmp:opacity-100 group-focus-visible/cmp:opacity-100">
            {inCompare ? "Remove from compare" : "Add to compare"}
          </span>
        </button>
        <HeartButton id={card.dep_id} onPhoto />
      </div>
    </article>
  );
}

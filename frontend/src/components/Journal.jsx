import { useId } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { http } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import { useApp } from "@/context/AppState";
import { EASE, EllipseLink, Reveal } from "@/components/Decor";
import { InkLabel, InkTitle } from "@/components/Ink";
import { SKETCHES, thumb } from "@/lib/sketches";

// The home page below the sketchbook, as the back pages of the same travel journal: the trip styles as airmail stamps
// and the next departures as tickets pasted in. Same warm paper, blue ink, handwriting and red stamp as the hero.

const PAPER = "#fffdf9";
const RED = "#c9302a";
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .42  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Centred label, heading and a line of text, as each part of the journal opens. */
const Heading = ({ label, title, ink, children }) => (
  <div className="mx-auto max-w-[760px] text-center">
    <InkLabel>{label}</InkLabel>
    <InkTitle className="mt-4" ink={ink}>{title}</InkTitle>
    {children && <Reveal delay={0.1}><p className="mx-auto mt-5 max-w-[540px] text-[15px] leading-relaxed text-[#5b6066]">{children}</p></Reveal>}
  </div>
);

const departures = (n) => `${n} departure${n === 1 ? "" : "s"}`;

// ---------- trip styles, as airmail stamps ----------
const STYLE_NAMES = {
  hiking: "Treks", backpacking: "Backpacking", beaches: "Beaches", winter: "Snow", roadtrip: "Road trips", party: "Festivals",
  wildlife: "Wildlife", spiritual: "Spiritual", offbeat: "Offbeat", luxury: "Luxury", culture_food: "Food & culture",
};
// which of the sketchbook's photos goes on each style's stamp
const STYLE_PHOTOS = {
  women: "alleppey", hiking: "machapuchare", backpacking: "halong", beaches: "andaman", winter: "kedarkantha", roadtrip: "pangong",
  party: "hoian", wildlife: "maasaimara", spiritual: "goldentemple", offbeat: "rootbridge", luxury: "lemorne", culture_food: "registan",
};
const TILT = [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5, -1, 3];
const LABEL_TILT = [7, -5, 6, 8, -6, 5, 7, -4, 6, -7];
const LABEL_INKS = ["#6f8f8c", "#b4473e", "#3f5fbf", "#5f7f52"];

// the stamp: a sheet perforated all round its edge, with the picture in a window inside, drawn on a canvas a bit
// bigger than the stamp so the airmail label can hang over its corner
const SX = 12, SY = 14, SW = 250, SH = 200, HOLE = 7.5, WIN = 20;
const HOLES = (() => {
  const nx = Math.round(SW / 21), ny = Math.round(SH / 21), out = [];
  for (let k = 0; k <= nx; k++) out.push([SX + (k * SW) / nx, SY], [SX + (k * SW) / nx, SY + SH]);
  for (let k = 1; k < ny; k++) out.push([SX, SY + (k * SH) / ny], [SX + SW, SY + (k * SH) / ny]);
  return out;
})();
// shrinks a line of serif capitals until it fits across the label
const fit = (s, room, size, spacing) => Math.min(size, (room / s.length - spacing) / 0.7);

function AirmailStamp({ to, label, sub, photo, i, testId }) {
  const id = useId().replace(/:/g, "");
  const ink = LABEL_INKS[i % LABEL_INKS.length], tilt = TILT[i % TILT.length];
  const name = label.toUpperCase(), note = sub.toUpperCase();
  const big = fit(name, 112, 21, 0.6), small = fit(note, 112, 10.5, 1.2);
  const win = { x: SX + WIN, y: SY + WIN, width: SW - 2 * WIN, height: SH - 2 * WIN };
  return (
    <motion.div initial={{ opacity: 0, y: 40, rotate: tilt * 3 }} whileInView={{ opacity: 1, y: 0, rotate: tilt }} viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 + i * 0.07 }} whileHover={{ rotate: 0, y: -8, scale: 1.04 }}
      className="group w-[46%] max-w-[270px] sm:w-[240px]">
      <Link to={to} data-testid={testId} aria-label={`${label}: ${sub}`} className="block">
        <svg viewBox="0 0 330 262" className="block h-auto w-full overflow-visible transition-[filter] duration-300 [filter:drop-shadow(0_6px_8px_rgba(28,34,44,.16))] group-hover:[filter:drop-shadow(0_18px_18px_rgba(28,34,44,.24))]">
          <defs>
            <mask id={`${id}-perf`}>
              <rect x={SX} y={SY} width={SW} height={SH} fill="#fff" />
              {HOLES.map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={HOLE} fill="#000" />)}
            </mask>
            <clipPath id={`${id}-win`}><rect {...win} rx="2" /></clipPath>
          </defs>
          <rect x={SX} y={SY} width={SW} height={SH} fill="#f6f5f1" mask={`url(#${id}-perf)`} />
          {photo && <image href={thumb(photo)} {...win} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-win)`} />}
          <rect {...win} rx="2" fill="none" stroke="rgba(28,34,44,.18)" strokeWidth="1.5" />
          {/* the airmail label, stuck over the stamp's corner with a thump once the stamp has landed */}
          <g transform={`translate(${SX + SW - 4} ${SY + SH - 32}) rotate(${LABEL_TILT[i % LABEL_TILT.length]})`}>
            <motion.g initial={{ opacity: 0, scale: 1.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.45 + i * 0.07 }}>
              <rect x="-66" y="-26" width="132" height="52" fill="#f6f5f1" stroke={ink} strokeWidth="2" />
              <rect x="-62" y="-22" width="124" height="44" fill="none" stroke={ink} strokeWidth="1" />
              <rect x="-62" y="2" width="124" height="20" fill={ink} />
              <g textAnchor="middle" fontFamily="Fraunces, Georgia, serif">
                <text y={-10 + big * 0.34} fontSize={big} letterSpacing="0.6" fill={ink}>{name}</text>
                <text y="16" fontSize={small} letterSpacing="1.2" fill="#f6f5f1">{note}</text>
              </g>
            </motion.g>
          </g>
        </svg>
      </Link>
    </motion.div>
  );
}

export function Styles({ styles }) {
  const photo = (id) => SKETCHES.find((s) => s.id === STYLE_PHOTOS[id])?.src;
  const stamps = [
    { id: "women", to: "/trips/women-only-trips", label: "Women-only", sub: "all-women groups" },
    ...Object.entries(styles || {}).filter(([k, n]) => n > 0 && STYLE_NAMES[k]).sort((a, b) => b[1] - a[1]).slice(0, 9)
      .map(([k, n]) => ({ id: k, to: `/search?style=${k}`, label: STYLE_NAMES[k], sub: departures(n) })),
  ];
  return (
    <section className="mx-auto max-w-[1120px] px-4 pt-28 sm:px-8 sm:pt-36" data-testid="journal-styles">
      <Heading label="Trip styles" title="What kind of" ink="trip?">Treks, beaches, snow or a festival. Pick a stamp to see every departure of that kind.</Heading>
      <div className="mx-auto mt-16 flex max-w-[1060px] flex-wrap items-start justify-center gap-x-3 gap-y-10 sm:gap-x-6 sm:gap-y-12">
        {stamps.map(({ id, ...s }, i) => <AirmailStamp key={id} {...s} photo={photo(id)} i={i} testId={`stamp-${id}`} />)}
      </div>
    </section>
  );
}

// ---------- leaving soon, as tickets ----------
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const seatNote = (c) => (c.seats_left != null && c.seats_left <= 5 ? `${c.seats_left} seat${c.seats_left === 1 ? "" : "s"} left` : c.status === "filling" ? "Filling fast" : null);
// a bite out of the top and bottom of the tear line: each half of the ticket is masked by its own round hole
const STUB = 88;
const BITES = `radial-gradient(circle at ${STUB}px 0, transparent 9px, #000 9.5px) top / 100% 51% no-repeat, radial-gradient(circle at ${STUB}px 100%, transparent 9px, #000 9.5px) bottom / 100% 51% no-repeat`;

function Ticket({ c, i }) {
  const { currency } = useApp();
  const date = new Date(`${c.start}T00:00:00`);
  const note = seatNote(c);
  const tilt = [-1.2, 0.9, -0.5, 1.3, -0.9, 0.6][i % 6];
  return (
    <motion.div initial={{ opacity: 0, y: 30, rotate: tilt * 3 }} whileInView={{ opacity: 1, y: 0, rotate: tilt }} viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay: (i % 3) * 0.1, ease: EASE }} whileHover={{ y: -6, rotate: 0 }} className="w-[86%] shrink-0 snap-center sm:w-auto"
      style={{ filter: "drop-shadow(0 1px 1px rgba(28,34,44,.08)) drop-shadow(0 14px 16px rgba(28,34,44,.14))" }}>
      <Link to={`/trip/${c.trip_id}?dep=${encodeURIComponent(c.dep_id)}`} data-testid={`ticket-${c.dep_id}`} className="relative flex h-full rounded-[4px]"
        style={{ background: `${GRAIN}, ${PAPER}`, WebkitMask: BITES, mask: BITES }}>
        <div className="flex shrink-0 flex-col items-center justify-center py-5 text-center" style={{ width: STUB }}>
          <span className="text-[11px] tracking-[.12em] text-[#5f656b]">{MON[date.getMonth()]}</span>
          <span className="mt-1 font-['Jost'] text-[44px] font-light leading-none text-coral">{date.getDate()}</span>
          <span className="mt-1.5 text-[11px] tracking-[.12em] text-[#5f656b]">{DAY[date.getDay()]}</span>
        </div>
        <span aria-hidden className="absolute bottom-3 top-3 border-l-[1.5px] border-dashed border-[#d3cbbb]" style={{ left: STUB }} />
        <div className="flex min-w-0 flex-1 flex-col px-5 py-4">
          <span className="truncate text-[11px] uppercase tracking-[.12em] text-[#5f656b]">{c.destination}</span>
          <span className="mt-1.5 line-clamp-2 text-[16.5px] leading-snug text-[#16181b]">{c.title}</span>
          <span className="mt-1.5 truncate text-[12.5px] text-[#6b7075]">{c.op?.name} · {c.duration} days</span>
          <span className="mt-auto flex items-end justify-between gap-2 pt-3">
            <span className="text-[19px] font-medium tabular-nums text-[#16181b]">{money(c.true_price, currency, true)}</span>
            {note && <span className="-rotate-6 rounded-[3px] border-[1.5px] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.16em] mix-blend-multiply" style={{ color: RED, borderColor: RED }}>{note}</span>}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function LeavingSoon() {
  const { data } = useQuery({ queryKey: ["home-tickets"], queryFn: () => http.get("/search?sort=soonest&limit=24").then((r) => r.data), staleTime: 300000 });
  // from tomorrow on: a trip leaving today is one nobody can still join
  const today = todayIso();
  const list = (data?.clusters || []).map((c) => c.lead).filter((c) => c.status !== "cancelled" && c.start > today).slice(0, 6);
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-28 sm:px-8 sm:pb-14 sm:pt-36" data-testid="journal-tickets">
      <Heading label="Leaving soon" title="The next" ink="departures.">The soonest trips from every operator. Some only have a couple of seats left.</Heading>
      <div className="-mx-4 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 pt-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-7 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {list.map((c, i) => <Ticket key={c.dep_id} c={c} i={i} />)}
      </div>
      <div className="mt-8 flex justify-center"><EllipseLink to="/search?sort=soonest" testId="tickets-see-all" className="text-coral">See every departure</EllipseLink></div>
    </section>
  );
}

/** The home page below the sketchbook. */
export default function Journal({ styles }) {
  return (
    <div id="home-below" className="relative z-10" data-testid="journal">
      <Styles styles={styles} />
      <LeavingSoon />
    </div>
  );
}

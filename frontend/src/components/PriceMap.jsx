import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shortMoney } from "@/lib/format";
import { useApp } from "@/context/AppState";
import TripPhoto from "./TripPhoto";

// The map beside the results, as on Airbnb: a white price pill on each destination, black for the one whose trip is
// under the pointer. Where pills would overlap, the busier place keeps its pill and the others shrink to dots until you
// zoom in. Any of them opens a little card for that place; its button narrows the results to it.
// Tiles are Stadia Maps' Alidade Smooth (OpenStreetMap data): free on localhost, an account and key needed once live.

const pill = (text, on) => L.divIcon({ className: "", iconSize: null, html: `<span class="air-pin${on ? " is-on" : ""}">${text}</span>` });
const dot = L.divIcon({ className: "", iconSize: null, html: '<span class="air-dot"></span>' });

/** Zooms to fit the places in the results whenever they change; to India alone when most of the departures are there. */
function Fit({ points }) {
  const map = useMap();
  const key = points.map((p) => p.slug).join(",");
  const fit = useCallback(() => {
    if (!points.length) return;
    const home = points.filter((p) => p.dtype === "domestic");
    const deps = (ps) => ps.reduce((s, p) => s + p.count, 0);
    const focus = home.length && deps(home) >= deps(points) / 2 ? home : points;
    map.fitBounds(L.latLngBounds(focus.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 7 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(fit, [fit]);
  // the map starts collapsed, with no width to fit anything into, so fit again once it has opened out to its full size
  useEffect(() => {
    const el = map.getContainer();
    let hidden = el.clientWidth < 50, t;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth < 50) { hidden = true; return; }
      if (!hidden) return;
      clearTimeout(t);
      t = setTimeout(() => { hidden = false; map.invalidateSize(); fit(); }, 350);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [map, fit]);
  return null;
}

function Pins({ points, active, onPick }) {
  const map = useMap();
  const { currency } = useApp();
  const short = (n) => shortMoney(n, currency);
  const [pills, setPills] = useState(() => new Set());
  // which places get a pill at this zoom: the one under the pointer first, then the ones with most departures
  const layout = useCallback(() => {
    const placed = [];
    const out = new Set();
    const order = [...points].sort((a, b) => Number(b.slug === active) - Number(a.slug === active) || b.count - a.count);
    for (const p of order) {
      const c = map.latLngToContainerPoint([p.lat, p.lng]);
      const w = shortMoney(p.min_price, currency).length * 8.5 + 22, h = 28;
      const box = [c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      out.add(p.slug);
    }
    setPills(out);
  }, [map, points, active, currency]);
  useMapEvents({ zoomend: layout });
  useEffect(layout, [layout]);

  return points.map((p) => (
    <Marker key={p.slug} position={[p.lat, p.lng]} icon={pills.has(p.slug) ? pill(short(p.min_price), active === p.slug) : dot}
      zIndexOffset={active === p.slug ? 1000 : pills.has(p.slug) ? 100 : 0}>
      <Popup className="air-popup" closeButton={false} offset={[0, -14]}>
        <div className="w-[240px] overflow-hidden rounded-xl bg-[#fffdf9]" data-testid={`map-pin-${p.slug}`}>
          <TripPhoto src={p.image} dest={p.slug} alt={p.destination} className="aspect-[4/3] w-full object-cover" />
          <div className="px-3.5 pb-3.5 pt-2.5 text-[14px] leading-5 text-[#16181b]">
            <p className="font-semibold">{p.destination}</p>
            <p className="text-[#5b6066]">{p.count} {p.count === 1 ? "departure" : "departures"}</p>
            <p className="mt-1"><span className="font-semibold">from {short(p.min_price)}</span> per person</p>
            <button onClick={() => onPick(p)} className="mt-2.5 w-full rounded-lg bg-coral py-2 text-[13px] font-semibold text-white hover:brightness-[.88]">Show these trips</button>
          </div>
        </div>
      </Popup>
    </Marker>
  ));
}

/** Leaflet only notices a window resize, not its own box growing or shrinking, so redraw when the box changes. */
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// `onMode` adds a drawer handle to the map's left edge. "‹" expands it across the whole page; "›" collapses it a step:
// from the whole page back beside the list, and from beside the list shut, out of sight (`mode` "full", "split", "off")
export default function PriceMap({ points = [], active, onPick, className = "", mode = "split", onMode }) {
  const pins = useMemo(() => points.filter((p) => p.lat || p.lng), [points]);
  const handle = "grid h-10 w-9 place-items-center text-[#16181b] transition-colors hover:bg-black/[.04]";
  return (
    <div className={`relative isolate overflow-hidden ${className}`} data-testid="map-view">
      {onMode && (
        <div className="absolute left-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col overflow-hidden rounded-full bg-[#fffdf9] shadow-[0_0_0_1px_rgba(0,0,0,.08),0_2px_6px_rgba(0,0,0,.18)]" data-testid="map-size-controls">
          {mode !== "full" && (
            <>
              <button data-testid="map-expand" onClick={() => onMode("full")} aria-label="Expand map" title="Expand map" className={handle}><ChevronLeft size={18} strokeWidth={2.2} /></button>
              <span className="mx-2 h-px bg-[#e7dece]" />
            </>
          )}
          <button data-testid="map-collapse" onClick={() => onMode(mode === "full" ? "split" : "off")} aria-label="Collapse map" title="Collapse map" className={handle}>
            <ChevronRight size={18} strokeWidth={2.2} />
          </button>
        </div>
      )}
      <MapContainer center={[22, 80]} zoom={4} minZoom={2} zoomControl={false} scrollWheelZoom worldCopyJump className="h-full w-full bg-[#f2efe9]">
        <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png" maxZoom={19}
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <ZoomControl position="topright" />
        <KeepSized />
        <Fit points={pins} />
        <Pins points={pins} active={active} onPick={onPick} />
      </MapContainer>
    </div>
  );
}

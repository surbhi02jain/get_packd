import { useEffect, useMemo, useState } from "react";
import { SKETCHES, thumb } from "@/lib/sketches";

// the sketchbook's photos of each destination, for trips whose own photo won't load
const BY_DEST = new Map();
for (const s of SKETCHES) BY_DEST.set(s.dest, [...(BY_DEST.get(s.dest) ?? []), s.src]);

// the same trip always gets the same one of its destination's photos, and two trips to one place usually different ones
const pick = (list, seed) => {
  if (!list?.length) return undefined;
  let h = 0;
  for (const ch of String(seed ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

/**
 * A trip's photo, read from the operator's own site. Some sites refuse photos shown on another site (jugni.co.in sits
 * behind a Cloudflare challenge), some delete them, and a few trips come without one: then it shows the sketchbook's
 * photo of the destination instead, and failing that a plain tile. `large` asks for the full-size fallback (the trip
 * page's hero); `as` renders a motion.img or similar in place of a plain img. `seed` (the trip's id) chooses between a
 * destination's photos, so trips to one place don't all fall back to the same picture.
 */
export default function TripPhoto({ src, dest, seed, alt = "", large = false, as: Img = "img", className = "", ...rest }) {
  const fallback = pick(BY_DEST.get(dest), seed ?? alt);
  const sources = useMemo(() => [src, fallback && (large ? fallback : thumb(fallback, 960))].filter(Boolean), [src, fallback, large]);
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [sources]);
  if (n >= sources.length) return <span aria-hidden data-testid="trip-photo-blank" className={`block bg-[#e7dece] ${className}`} />;
  return <Img src={sources[n]} alt={alt} onError={() => setN((i) => i + 1)} className={className} {...rest} />;
}

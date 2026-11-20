import { useEffect, useMemo, useState } from "react";
import { SKETCHES, thumb } from "@/lib/sketches";

// the sketchbook's photo of each destination (the first one listed for it), for trips whose own photo won't load
const BY_DEST = new Map();
for (const s of SKETCHES) if (!BY_DEST.has(s.dest)) BY_DEST.set(s.dest, s.src);

/**
 * A trip's photo, read from the operator's own site. Some sites refuse photos shown on another site (jugni.co.in sits
 * behind a Cloudflare challenge), some delete them, and a few trips come without one: then it shows the sketchbook's
 * photo of the destination instead, and failing that a plain tile. `large` asks for the full-size fallback (the trip
 * page's hero); `as` renders a motion.img or similar in place of a plain img.
 */
export default function TripPhoto({ src, dest, alt = "", large = false, as: Img = "img", className = "", ...rest }) {
  const fallback = BY_DEST.get(dest);
  const sources = useMemo(() => [src, fallback && (large ? fallback : thumb(fallback, 960))].filter(Boolean), [src, fallback, large]);
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [sources]);
  if (n >= sources.length) return <span aria-hidden data-testid="trip-photo-blank" className={`block bg-[#e7dece] ${className}`} />;
  return <Img src={sources[n]} alt={alt} onError={() => setN((i) => i + 1)} className={className} {...rest} />;
}

import { feature } from "topojson-client";

let cache = null;
export const loadLand = () => {
  if (!cache) {
    cache = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
      .then((r) => r.json())
      .then((t) => feature(t, t.objects.land))
      .catch(() => null);
  }
  return cache;
};

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

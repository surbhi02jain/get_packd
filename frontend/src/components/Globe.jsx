import { useEffect, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoInterpolate, geoDistance } from "d3-geo";
import { loadLand, reducedMotion } from "@/lib/world";

const HUB = [77.2, 28.6];

export default function Globe({ points = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let land = null, raf, size = 0, alive = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const proj = geoOrthographic().clipAngle(90);
    const path = geoPath(proj, ctx);
    const grat = geoGraticule10();
    const arcs = points.map((p, k) => ({ to: [p.lng, p.lat], interp: geoInterpolate(HUB, [p.lng, p.lat]), off: k * 0.37 }));
    const resize = () => {
      size = canvas.parentElement.clientWidth;
      canvas.width = size * dpr; canvas.height = size * dpr;
      canvas.style.width = size + "px"; canvas.style.height = size + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      proj.scale(size / 2 - 4).translate([size / 2, size / 2]);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    loadLand().then((l) => { land = l; });
    const still = reducedMotion();
    const draw = (t) => {
      if (!alive) return;
      const rot = still ? -60 : -60 - (t / 1000) * 6;
      proj.rotate([rot, -18]);
      ctx.clearRect(0, 0, size, size);
      const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size / 2, size / 2, size / 2);
      g.addColorStop(0, "#17384a"); g.addColorStop(1, "#08161f");
      ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); path(grat); ctx.strokeStyle = "rgba(250,246,239,0.07)"; ctx.lineWidth = 0.6; ctx.stroke();
      if (land) { ctx.beginPath(); path(land); ctx.fillStyle = "rgba(250,246,239,0.16)"; ctx.fill(); ctx.strokeStyle = "rgba(250,246,239,0.25)"; ctx.stroke(); }
      const center = [-rot, 18];
      arcs.forEach((a, k) => {
        const prog = still ? 1 : Math.min(1, ((t / 3200 + a.off) % 2.2));
        const n = 40, pts = [];
        for (let i = 0; i <= n * prog; i++) pts.push(a.interp(i / n));
        if (pts.length > 1) {
          ctx.beginPath(); path({ type: "LineString", coordinates: pts });
          ctx.strokeStyle = k % 3 === 0 ? "rgba(255,181,71,0.85)" : "rgba(255,107,74,0.8)"; ctx.lineWidth = 1.4; ctx.stroke();
        }
        if (geoDistance(a.to, center) < Math.PI / 2) {
          const [x, y] = proj(a.to);
          ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fillStyle = "#FFB547"; ctx.fill();
        }
        if (k === 0 && prog < 1 && pts.length > 1) {
          const head = pts[pts.length - 1];
          if (geoDistance(head, center) < Math.PI / 2) {
            const [x, y] = proj(head);
            ctx.font = "14px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText("✈", x - 6, y + 5);
          }
        }
      });
      if (geoDistance(HUB, center) < Math.PI / 2) {
        const [x, y] = proj(HUB);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = "#FF6B4A"; ctx.fill();
      }
      ctx.beginPath(); path({ type: "Sphere" }); ctx.strokeStyle = "rgba(255,181,71,0.25)"; ctx.lineWidth = 1; ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [points]);
  return <canvas ref={ref} data-testid="hero-globe" aria-label="Rotating globe with routes to destinations" />;
}

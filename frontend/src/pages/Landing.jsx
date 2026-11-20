import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MotionConfig, useReducedMotion } from "framer-motion";
import { http } from "@/lib/api";
import SkyHero from "@/components/landing/SkyHero";
import Stories from "@/components/landing/Stories";
import HowItWorks from "@/components/landing/HowItWorks";
import { Platform, Trust } from "@/components/landing/Features";
import { Closing, OperatorsBlock } from "@/components/landing/Closing";
import { LandingNav, ScrollTicks } from "@/components/landing/parts";
import "@/components/landing/landing.css";

const FONTS = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap";

function useFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONTS;
    document.head.appendChild(l);
  }, []);
}

/**
 * A second landing page, kept apart from the live home at "/": the sky-and-paper-plane design (after the Trajectory
 * site the user picked on collectui). Open it at /landing.
 */
export default function Landing() {
  useFonts();
  const reduced = !!useReducedMotion();
  const [revealed, setRevealed] = useState(reduced);
  const onReveal = useCallback(() => setRevealed(true), []);

  // this page is always light, whatever theme the rest of the app is in
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    const prevTitle = document.title;
    document.title = "getPackd · Group trips, side by side";
    return () => { if (wasDark) html.classList.add("dark"); document.title = prevTitle; };
  }, []);

  const { data: home } = useQuery({ queryKey: ["home"], queryFn: () => http.get("/home").then((r) => r.data) });
  const { data: ops } = useQuery({ queryKey: ["landing-operators"], queryFn: () => http.get("/operators").then((r) => r.data) });
  const dests = home?.destinations || [];
  const stats = home?.stats;
  const operators = useMemo(
    () => (ops?.items || []).filter((o) => o.departures > 0).sort((a, b) => b.departures - a.departures),
    [ops],
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="lp" data-testid="landing-page">
        <LandingNav visible={revealed} />
        <ScrollTicks />
        <SkyHero stats={stats} reduced={reduced} onReveal={onReveal} />
        <Stories dests={dests} operators={operators} />
        <HowItWorks reduced={reduced} />
        <Platform reduced={reduced} />
        <Trust />
        <OperatorsBlock stats={stats} operators={operators} />
        <Closing />
      </div>
    </MotionConfig>
  );
}

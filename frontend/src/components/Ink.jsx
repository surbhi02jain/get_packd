import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppState";
import { Reveal } from "@/components/Decor";

// The landing page's sketchbook look: warm paper, blue ink, Jost. Shared by the home page's sections.
/** The site's blue ink, as a CSS colour, for code that paints with it (a canvas, confetti): the --coral token. */
export const inkColor = () => {
  const v = typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--coral").trim() : "";
  return v ? `rgb(${v.split(/\s+/).join(",")})` : "#2b3f99";
};

/** Small spaced-out caption, like the line above the name on the hero. */
export const InkLabel = ({ children, className = "" }) => (
  <Reveal className={`text-[11px] font-medium uppercase tracking-[.14em] text-[#5f656b] ${className}`}>{children}</Reveal>
);

/** Section heading in light Jost; `ink` is a word or two after it in blue, as if added later in pen. */
export const InkTitle = ({ children, ink, className = "", as: Tag = "h2" }) => (
  <Reveal delay={0.05}>
    <Tag className={`font-['Jost'] text-[clamp(2.1rem,4.4vw,3.6rem)] font-light leading-[1.04] tracking-[-.015em] text-[#16181b] ${className}`}>
      {children}{ink && <> <span className="text-coral">{ink}</span></>}
    </Tag>
  </Reveal>
);

let inkUsers = 0; // how many mounted components want the theme; the last one to go takes it off

/**
 * Puts the site in the sketchbook theme while it is mounted: always light, blue ink for the accent colour. App turns
 * it on for every page; it is set on <html> so popovers, which render outside the page, follow it too.
 */
export function useInkPage() {
  const { dark } = useApp();
  const wanted = useRef(dark);
  wanted.current = dark;
  useEffect(() => {
    const root = document.documentElement;
    // the app sets "dark" from the saved preference, sometimes after this runs, so keep taking it off while we're here
    const strip = () => root.classList.contains("dark") && root.classList.remove("dark");
    const watch = new MutationObserver(strip);
    strip();
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });
    inkUsers += 1;
    root.classList.add("theme-ink");
    return () => {
      watch.disconnect();
      if (--inkUsers > 0) return;
      root.classList.remove("theme-ink");
      root.classList.toggle("dark", wanted.current);
    };
  }, []);
}

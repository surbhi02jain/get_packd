// Quick visual probe: console errors + frames at chosen act positions.
// usage: node tools/probe.mjs <outdir> [width height] [--reduced] [--query dest=spiti]
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = process.argv[2] || "lab/probe";
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const reduced = process.argv.includes("--reduced");
const qi = process.argv.indexOf("--query"); const query = qi > -1 ? process.argv[qi + 1] : "";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: W < 800, isMobile: W < 800 });
await ctx.addInitScript(() => { Element.prototype.requestPointerLock = function () {}; Element.prototype.setPointerCapture = function () {}; });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("requestfailed", (r) => errs.push("requestfailed: " + r.url()));
await page.goto("http://localhost:4500/", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
if (query) {
  const [k, v] = query.split("=");
  await page.selectOption(k === "dest" ? "#where" : "#when", v);
  await page.waitForTimeout(300);
}
const acts = await page.evaluate(() => [...document.querySelectorAll("[data-sc-act]")].map((a) => {
  const r = a.getBoundingClientRect(); return { id: a.id, top: r.top + scrollY, h: r.height, pinned: a.dataset.scAct === "pin" || a.dataset.scAct === "pan" };
}));
const vh = H;
const plan = [];
for (const a of acts) {
  const fr = a.pinned ? [0, 0.25, 0.5, 0.75, 1] : [0.25, 0.6];
  for (const f of fr) {
    const y = a.pinned ? a.top + (a.h - vh) * f : a.top - vh + (a.h + vh) * f;
    plan.push({ name: `${a.id}-${String(Math.round(f * 100)).padStart(3, "0")}`, y: Math.max(0, Math.round(y)) });
  }
}
for (const s of plan) {
  await page.evaluate((y) => window.scrollTo(0, y), s.y);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${s.name}.png` });
}
const info = await page.evaluate(() => ({
  docH: document.documentElement.scrollHeight / innerHeight,
  noGL: document.documentElement.classList.contains("no-gl"),
  rail: (() => { const r = document.querySelector("[data-sc-pan]"); return r ? r.scrollWidth - innerWidth : null; })(),
  overflowX: document.documentElement.scrollWidth - innerWidth,
}));
console.log(JSON.stringify({ acts, info, errs }, null, 1));
await browser.close();

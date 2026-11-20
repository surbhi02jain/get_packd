// Hero copy contrast over every place (the harness hides the fixed WebGL layer, so measure here).
// usage: node tools/contrast-hero.mjs <out> [w h]   then: python tools/contrast.py <out>
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = process.argv[2] || "lab/contrast-hero"; const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 800, isMobile: W < 800 });
const page = await ctx.newPage();
await page.goto("http://localhost:4500/?review=0", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const rows = [];
for (let k = 0; k < 6; k++) {
  await page.click(`[data-dots] button[data-k="${k}"]`);
  await page.click('[data-dots] [data-pause]').catch(() => {});        // hold the place still
  await page.waitForTimeout(1900);
  const name = `place-${k}`;
  const lines = await page.evaluate(() => {
    const res = [];
    document.querySelectorAll(".hero h1, .hero__sub, .place b, .place span").forEach((el) => {
      const range = document.createRange(); range.selectNodeContents(el);
      [...range.getClientRects()].forEach((r) => { if (r.width > 4 && r.height > 4) res.push({ t: el.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }); });
    });
    document.querySelectorAll(".hero h1, .hero__sub, .hero__foot").forEach((e) => (e.style.visibility = "hidden"));
    return res;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}-bg.png` });
  await page.evaluate(() => document.querySelectorAll(".hero h1, .hero__sub, .hero__foot").forEach((e) => (e.style.visibility = "")));
  await page.screenshot({ path: `${out}/${name}-on.png` });
  await page.click('[data-dots] [data-pause]').catch(() => {});        // resume for the next one
  rows.push({ name, lines });
}
fs.writeFileSync(`${out}/lines.json`, JSON.stringify(rows, null, 1));
await browser.close();
console.log("ok", rows.map((r) => r.name + ":" + r.lines.length).join(" "));

// Contrast of copy over the fixed WebGL scene and star canvas, which the harness
// hides as "fixed chrome". Shoots each position twice (with and without copy),
// then tools/contrast.py grades each text line against the brightest patch under it.
// usage: node tools/contrast.mjs <outdir> [width height]
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = process.argv[2] || "lab/contrast";
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 800, isMobile: W < 800 });
await ctx.addInitScript(() => { Element.prototype.requestPointerLock = function () {}; });
const page = await ctx.newPage();
await page.goto("http://localhost:4500/", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const at = async (id, f) => page.evaluate(([id, f]) => {
  const a = document.getElementById(id), r = a.getBoundingClientRect(), top = r.top + scrollY;
  window.scrollTo(0, Math.round(top + (r.height - innerHeight) * f));
}, [id, f]);
const shots = [["gate", 0], ["gate", 0.12], ["gate", 0.7], ["gate", 0.82], ["market", 0.2], ["market", 0.3], ["market", 0.66], ["market", 0.85]];
const rows = [];
for (const [id, f] of shots) {
  await at(id, f); await page.waitForTimeout(500);
  const name = `${id}-${Math.round(f * 100)}`;
  await page.screenshot({ path: `${out}/${name}-on.png` });
  const lines = await page.evaluate((id) => {
    const res = [];
    const sel = id === "gate" ? ".gate__copy, .gate__beat" : ".market__copy";
    document.querySelectorAll(sel).forEach((blk) => {
      if (+getComputedStyle(blk).opacity < 0.95) return;
      blk.querySelectorAll("h1, h2, p, .big").forEach((el) => {
        const range = document.createRange(); range.selectNodeContents(el);
        [...range.getClientRects()].forEach((r) => {
          if (r.width < 4 || r.bottom < 0 || r.top > innerHeight) return;
          res.push({ t: el.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) });
        });
      });
    });
    document.querySelectorAll(".gate__copy, .gate__beat, .market__copy, .tip").forEach((e) => (e.style.visibility = "hidden"));
    return res;
  }, id);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/${name}-bg.png` });
  await page.evaluate(() => document.querySelectorAll(".gate__copy, .gate__beat, .market__copy").forEach((e) => (e.style.visibility = "")));
  rows.push({ name, lines });
}
fs.writeFileSync(`${out}/lines.json`, JSON.stringify(rows, null, 1));
await browser.close();
console.log("ok", rows.map((r) => r.name + ":" + r.lines.length).join(" "));

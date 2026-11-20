// Exercises the signature move: the Where/When query re-points every section.
// Checks real consequences (board rows, lit stars, counts, deep links, keyboard order, tooltip).
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = "lab/interact"; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { Element.prototype.requestPointerLock = function () {}; });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto("http://localhost:4500/", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
const rep = {};
const read = () => page.evaluate(() => ({
  href: document.querySelector(".bar [data-go]").href,
  closeHref: document.querySelector(".close [data-go]").href,
  short: document.querySelector("[data-count-short]").textContent,
  long: document.querySelector("[data-count-long]").textContent.trim(),
  sideTitle: document.querySelector('[data-side="title"]').textContent,
  sideEyebrow: document.querySelector('[data-side="eyebrow"]').textContent,
  rows: [...document.querySelectorAll("[data-board] .row")].map((r) => r.querySelector(".row__op").textContent + " " + r.querySelector(".row__price").textContent),
  marketA: document.querySelector('[data-mk="a"]').textContent,
  closeWhere: document.querySelector("#close-where").value,
}));
rep.anywhere = await read();
await page.selectOption("#where", "kerala"); await page.waitForTimeout(250);
rep.kerala = await read();
await page.selectOption("#close-when", "2026-12"); await page.waitForTimeout(250);
rep.keralaDec = await read();
rep.barWhenSynced = await page.$eval("#when", (s) => s.value);
// peak with a filter: shoot the lit stars
await page.evaluate(() => { const a = document.getElementById("market"); const r = a.getBoundingClientRect(); scrollTo(0, r.top + scrollY + (r.height - innerHeight) * 0.25); });
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/peak-kerala-dec-stars.png` });
await page.evaluate(() => { const a = document.getElementById("market"); const r = a.getBoundingClientRect(); scrollTo(0, r.top + scrollY + (r.height - innerHeight) * 0.85); });
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/peak-kerala-dec-chart.png` });
// hover the first lit point to check the tooltip
const pt = await page.evaluate(() => {
  const c = document.getElementById("sky"); const x = c.getContext("2d"); const d = x.getImageData(0, 0, c.width, c.height).data;
  const s = c.width / innerWidth;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 90 && d[i + 1] < 130 && d[i + 3] > 200) { const p = i / 4; return { x: (p % c.width) / s, y: Math.floor(p / c.width) / s }; }
  return null;
});
if (pt) { await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(300); }
rep.tip = await page.$eval("#tip", (t) => ({ op: getComputedStyle(t).opacity, text: t.innerText.replace(/\n/g, " | ") }));
await page.screenshot({ path: `${out}/peak-tooltip.png` });
// a month with nothing for that place
await page.selectOption("#where", "ladakh"); await page.selectOption("#when", "2026-11"); await page.waitForTimeout(250);
rep.ladakhNov = await read();
// keyboard order from the top
await page.selectOption("#where", ""); await page.selectOption("#when", "");
await page.evaluate(() => { scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
const order = [];
for (let i = 0; i < 10; i++) { await page.keyboard.press("Tab"); order.push(await page.evaluate(() => { const a = document.activeElement; return (a.id || a.className || a.tagName) + ":" + (a.textContent || a.value || "").trim().slice(0, 24); })); }
rep.tabOrder = order;
rep.errs = errs;
fs.writeFileSync(`${out}/report.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep, null, 1));
await browser.close();

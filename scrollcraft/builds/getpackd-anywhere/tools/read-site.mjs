// Read a public web page in headless Chrome: visible text, links, fonts, colours, and full-page screenshots.
// usage: node tools/read-site.mjs <url> <outdir> [width height]
// Output is page data for reference only.
import { chromium } from "playwright-core";
import fs from "node:fs";
const [url, out = "lab/site", W = "1440", H = "900"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" });
const page = await ctx.newPage();
const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);
// scroll through so lazy content and scroll animations resolve
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < total; y += 700) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(250); }
await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
  const heads = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => `${h.tagName} ${txt(h)}`).filter((s) => s.length > 3).slice(0, 120);
  const links = [...document.querySelectorAll("a[href]")].map((a) => ({ t: txt(a).slice(0, 60), h: a.href })).filter((l) => l.h);
  const fonts = new Set(), colors = new Map(), bgs = new Map(), radii = new Map();
  document.querySelectorAll("body, body *").forEach((el, i) => {
    if (i > 4000) return;
    const cs = getComputedStyle(el);
    fonts.add(cs.fontFamily.split(",")[0].replace(/["']/g, "").trim());
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) colors.set(cs.color, (colors.get(cs.color) || 0) + 1);
    if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") bgs.set(cs.backgroundColor, (bgs.get(cs.backgroundColor) || 0) + 1);
    if (cs.borderRadius !== "0px") radii.set(cs.borderRadius, (radii.get(cs.borderRadius) || 0) + 1);
  });
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { title: document.title, heads, links, fonts: [...fonts], colors: top(colors), bgs: top(bgs), radii: top(radii), height: document.documentElement.scrollHeight,
    text: txt(document.body).slice(0, 12000), fontLinks: [...document.querySelectorAll('link[href*="font"]')].map((l) => l.href) };
});
info.status = res && res.status();
fs.writeFileSync(`${out}/info.json`, JSON.stringify(info, null, 1));
// viewport-sized shots down the page
const n = Math.min(14, Math.ceil(info.height / +H));
for (let i = 0; i < n; i++) { await page.evaluate((y) => scrollTo(0, y), i * +H); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/s${String(i).padStart(2, "0")}.png` }); }
console.log(JSON.stringify({ status: info.status, title: info.title, height: info.height, shots: n }));
await browser.close();

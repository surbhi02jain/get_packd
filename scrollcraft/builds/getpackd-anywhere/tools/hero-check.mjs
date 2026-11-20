// Hero check: shoots the cycling places over time, the popovers, and the docked bar.
// usage: node tools/hero-check.mjs <out> [w h]
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = process.argv[2] || "lab/hero"; const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 800, isMobile: W < 800 });
await ctx.addInitScript(() => { Element.prototype.requestPointerLock = function () {}; });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto("http://localhost:4500/?review=0", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const cap = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); return page.evaluate(() => ({ place: document.querySelector("[data-place-name]").textContent, meta: document.querySelector("[data-place-meta]").textContent, state: document.getElementById("hero").getAttribute("data-sc-verify-state") })); };
const rep = {};
rep.t0 = await cap("01-open");
await page.waitForTimeout(7600); rep.t1 = await cap("02-second-place");
await page.waitForTimeout(7900); rep.t2 = await cap("03-third-place");
// dots jump to Meghalaya
await page.click('[data-dots] button[data-k="4"]'); await page.waitForTimeout(1700); rep.dot = await cap("04-dot-meghalaya");
// popovers
await page.click('.ff[aria-controls="pop-dest"]'); await page.waitForTimeout(300); await cap("05-pop-where");
await page.keyboard.press("Escape");
await page.click('.ff[aria-controls="pop-month"]'); await page.waitForTimeout(300); await cap("06-pop-when");
await page.click('#pop-month [data-val="2026-12"]'); await page.waitForTimeout(200);
await page.click('.ff[aria-controls="pop-budget"]'); await page.waitForTimeout(300); await cap("07-pop-budget");
await page.click('#pop-budget [data-val="20000-50000"]'); await page.waitForTimeout(200);
await page.click('.ff[aria-controls="pop-as"]'); await page.waitForTimeout(300);
await page.click('#pop-as [data-val="friends"]'); await page.keyboard.press("Escape");
await page.click('.ff[aria-controls="pop-dest"]'); await page.fill("#dest-filter", "ker"); await page.waitForTimeout(200); await cap("08-pop-where-typed");
await page.click('#pop-dest [data-val="kerala"]'); await page.waitForTimeout(1800);
rep.query = await page.evaluate(() => ({
  labels: [...document.querySelectorAll(".ff__v")].map((e) => e.textContent),
  go: document.querySelector("[data-go-label]").textContent, href: document.querySelector("[data-finder] [data-go]").href,
  barWhere: document.getElementById("where").value, closeWhen: document.getElementById("close-when").value,
  side: document.querySelector('[data-side="title"]').textContent,
  place: document.querySelector("[data-place-name]").textContent,
}));
rep.t3 = await cap("09-kerala-picked");
// docked bar after the hero
await page.evaluate(() => scrollTo({ top: innerHeight * 1.1, behavior: "instant" })); await page.waitForTimeout(500); await cap("10-docked-bar");
rep.errs = errs;
console.log(JSON.stringify(rep, null, 1));
await browser.close();

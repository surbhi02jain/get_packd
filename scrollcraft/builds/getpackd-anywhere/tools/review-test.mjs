// Loads the page with the Agentation review layer and reports what rendered.
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = "lab/review"; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { Element.prototype.requestPointerLock = function () {}; });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(m.type() + ": " + m.text()));
page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
page.on("requestfailed", (r) => logs.push("requestfailed: " + r.url()));
await page.goto("http://localhost:4500/", { waitUntil: "networkidle" });
await page.waitForSelector("[data-feedback-toolbar]", { timeout: 20000 }).catch(() => logs.push("toolbar not found"));
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const tb = document.querySelector("[data-feedback-toolbar]");
  const r = tb ? tb.getBoundingClientRect() : null;
  return {
    toolbar: !!tb, rect: r && { x: r.x, y: r.y, w: r.width, h: r.height },
    controls: tb ? [...tb.querySelectorAll("button, [role=button]")].map((b) => ({ label: b.getAttribute("aria-label") || b.title || b.textContent.trim().slice(0, 30), visible: !!b.offsetParent })) : [],
    reactRoot: !!document.getElementById("agentation-root"),
  };
});
await page.screenshot({ path: `${out}/01-loaded.png` });
console.log(JSON.stringify({ info, logs }, null, 1));
await browser.close();

// End-to-end check of the review loop: open the toolbar, annotate an element,
// confirm the note reaches feedback/annotations.*, then Send to Agent -> feedback/latest.md.
// Runs in an isolated browser profile; the real browser's notes are untouched.
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = "lab/review"; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { Element.prototype.requestPointerLock = function () {}; });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(m.type() + ": " + m.text()));
page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
await page.goto("http://localhost:4500/", { waitUntil: "networkidle" });
const tb = page.locator("[data-feedback-toolbar]").first();
await tb.waitFor({ timeout: 20000 });
const labels = async () => page.locator("[data-feedback-toolbar] button").evaluateAll((bs) => bs.map((b) => (b.getAttribute("aria-label") || b.title || b.textContent.trim()).slice(0, 40)));
const steps = { before: await labels() };
// open the toolbar
await page.locator('[data-feedback-toolbar] button[aria-label="Start feedback mode"]').click();
await page.waitForTimeout(600);
steps.opened = await labels();
await page.screenshot({ path: `${out}/02-open.png` });
// click the headline to start a note
await page.locator(".hero h1").click({ position: { x: 120, y: 40 } });
await page.waitForTimeout(500);
const ta = page.locator("[data-annotation-popup] textarea").first();
steps.popup = await ta.count();
if (steps.popup) {
  await ta.fill("Test note from the review-flow check: headline size feels right.");
  await page.screenshot({ path: `${out}/03-note.png` });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
}
steps.afterNote = await labels();
steps.file = fs.existsSync("feedback/annotations.json") ? JSON.parse(fs.readFileSync("feedback/annotations.json", "utf8")).map((a) => ({ element: a.element, comment: a.comment, scrollAct: a.scrollAct, viewport: a.viewport })) : null;
// Send to Agent, if the toolbar offers it
const send = page.locator('[data-feedback-toolbar] button[aria-label="Send Annotations"]');
steps.sendButtons = await send.count();
if (steps.sendButtons) { await send.first().click(); await page.waitForTimeout(800); }
steps.latest = fs.existsSync("feedback/latest.md") ? fs.readFileSync("feedback/latest.md", "utf8").slice(0, 900) : null;
await page.screenshot({ path: `${out}/04-after.png` });
console.log(JSON.stringify({ steps, logs }, null, 1));
await browser.close();

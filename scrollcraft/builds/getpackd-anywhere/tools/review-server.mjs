// Review server for the getPackd Anywhere page.
// Serves the build folder (like the skill's serve.mjs) and accepts Agentation
// feedback so Claude can read it straight from disk:
//
//   feedback/annotations.json   every live note on the page (mirrors the toolbar)
//   feedback/annotations.md     the same, readable
//   feedback/inbox.md           each "Send to Agent", appended with a timestamp
//   feedback/latest.md          the most recent "Send to Agent"
//
// usage: node tools/review-server.mjs [--port 4500]     (binds 127.0.0.1 only)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEED = path.join(ROOT, "feedback");
const argv = process.argv.slice(2);
const PORT = parseInt(argv[argv.indexOf("--port") + 1] || "4500", 10) || 4500;
fs.mkdirSync(FEED, { recursive: true });

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".md": "text/markdown; charset=utf-8",
  ".mp4": "video/mp4", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

// local time (sv-SE formats as YYYY-MM-DD HH:MM:SS)
const stamp = () => new Date().toLocaleString("sv-SE");
function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function asMarkdown(list) {
  if (!list.length) return "# Page notes\n\n_No notes on the page right now._\n";
  const lines = [`# Page notes (${list.length})`, "", `Updated ${stamp()}`, ""];
  list.forEach((a, i) => {
    lines.push(`## ${i + 1}. ${a.element || "element"}`);
    if (a.comment) lines.push("", a.comment.trim());
    const meta = [];
    if (a.elementPath) meta.push(`- **Path:** \`${a.elementPath}\``);
    if (a.selectedText) meta.push(`- **Selected text:** "${a.selectedText}"`);
    if (a.nearbyText) meta.push(`- **Nearby text:** ${String(a.nearbyText).slice(0, 200)}`);
    if (a.intent || a.severity) meta.push(`- **Intent / severity:** ${a.intent || "-"} / ${a.severity || "-"}`);
    if (typeof a.scrollY === "number") meta.push(`- **Scroll position:** ${a.scrollY}px (${a.scrollAct || "?"})`);
    if (a.viewport) meta.push(`- **Viewport:** ${a.viewport}`);
    if (a.boundingBox) meta.push(`- **Box:** ${Math.round(a.boundingBox.x)},${Math.round(a.boundingBox.y)} ${Math.round(a.boundingBox.width)}x${Math.round(a.boundingBox.height)}`);
    if (a.status) meta.push(`- **Status:** ${a.status}`);
    if (meta.length) lines.push("", ...meta);
    lines.push("");
  });
  return lines.join("\n");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "POST" && url.pathname === "/feedback/annotations") {
      const list = JSON.parse(await readBody(req));
      if (!Array.isArray(list)) throw new Error("expected an array");
      fs.writeFileSync(path.join(FEED, "annotations.json"), JSON.stringify(list, null, 1));
      fs.writeFileSync(path.join(FEED, "annotations.md"), asMarkdown(list));
      res.writeHead(200, { "Content-Type": "application/json" }).end("{\"ok\":true}");
      return;
    }
    if (req.method === "POST" && url.pathname === "/feedback/submit") {
      const { output = "", annotations = [], viewport = "" } = JSON.parse(await readBody(req));
      const block = `\n\n---\n\n## Sent ${stamp()}${viewport ? ` · viewport ${viewport}` : ""} · ${annotations.length} note${annotations.length === 1 ? "" : "s"}\n\n${String(output).trim()}\n`;
      fs.appendFileSync(path.join(FEED, "inbox.md"), block);
      fs.writeFileSync(path.join(FEED, "latest.md"), block.trimStart());
      console.log(`[review] Send to Agent: ${annotations.length} note(s) -> feedback/latest.md`);
      res.writeHead(200, { "Content-Type": "application/json" }).end("{\"ok\":true}");
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403).end(); return; }
    if (rel.startsWith("/node_modules") || rel.startsWith("/lab")) { res.writeHead(404).end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(String(e.message || e));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`[review] http://localhost:${PORT}  (feedback -> ${path.relative(process.cwd(), FEED) || FEED})`));

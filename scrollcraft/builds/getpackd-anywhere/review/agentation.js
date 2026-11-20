// Agentation review layer for the getPackd Anywhere page.
// Same toolbar the React app mounts in development (agentation 3.1.2 on React 19.0.0),
// loaded here as ES modules because this page has no bundler.
//
// Every note is mirrored to the review server (tools/review-server.mjs), stamped with
// the scroll position and act it was left at, so Claude can read feedback/annotations.md
// without anything being copied or pasted. "Send to Agent" writes feedback/latest.md.
// The toolbar's own Copy button still works as usual.
//
// Turn it off with ?review=0 (clean screenshots, demos).
const params = new URLSearchParams(location.search);
if (params.get("review") !== "0") boot().catch((e) => console.warn("[review] Agentation did not load:", e));

async function boot() {
  const V = { react: "19.0.0", agentation: "3.1.2" };
  const deps = `deps=react@${V.react},react-dom@${V.react}`;
  const [{ default: React }, { createRoot }, ag] = await Promise.all([
    import(`https://esm.sh/react@${V.react}`),
    import(`https://esm.sh/react-dom@${V.react}/client?${deps}`),
    import(`https://esm.sh/agentation@${V.agentation}?${deps}`),
  ]);
  const { Agentation, loadAnnotations } = ag;

  // ---- where on the page a note was left (a scroll page has no single state)
  const where = () => {
    const mid = innerHeight / 2;
    let act = "";
    document.querySelectorAll("[data-sc-act]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) {
        const p = el.style.getPropertyValue("--sc-p");
        act = el.id + (p ? ` p=${(+p).toFixed(2)}` : "");
      }
    });
    const q = ["where", "when"].map((id) => document.getElementById(id)).filter(Boolean).map((s) => s.value).filter(Boolean).join(" / ");
    return { scrollY: Math.round(scrollY), scrollAct: act, viewport: `${innerWidth}x${innerHeight}`, query: q || "Anywhere / Any month" };
  };

  // ---- mirror every note to disk through the review server
  const notes = new Map();
  try { (loadAnnotations(location.pathname) || []).forEach((a) => notes.set(a.id, a)); } catch {}
  let warned = false;
  const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => { if (!r.ok) throw new Error(r.status); })
    .catch(() => { if (!warned) { warned = true; console.warn("[review] notes are not reaching disk: start tools/review-server.mjs. Copy still works."); } });
  let t = 0;
  const sync = () => { clearTimeout(t); t = setTimeout(() => post("/feedback/annotations", [...notes.values()]), 150); };

  const props = {
    appName: "getPackd · Anywhere (scrollcraft build)",
    onAnnotationAdd: (a) => { notes.set(a.id, { ...a, ...where() }); sync(); },
    onAnnotationUpdate: (a) => { notes.set(a.id, { ...(notes.get(a.id) || where()), ...a }); sync(); },
    onAnnotationDelete: (a) => { notes.delete(a.id); sync(); },
    onAnnotationsClear: () => { notes.clear(); sync(); },
    onSubmit: (output, annotations) => {
      const ctx = annotations.map((a, i) => {
        const w = notes.get(a.id) || {};
        return `${i + 1}. ${a.element || "element"}: scrolled ${w.scrollY ?? "?"}px, act ${w.scrollAct || "?"}, viewport ${w.viewport || "?"}, query ${w.query || "?"}`;
      }).join("\n");
      post("/feedback/submit", { output: `${output}\n\n### Where each note was left\n\n${ctx}`, annotations, viewport: `${innerWidth}x${innerHeight}` });
    },
  };

  const host = document.createElement("div");
  host.id = "agentation-root";
  document.body.appendChild(host);
  createRoot(host).render(React.createElement(Agentation, props));
  sync();
}

/* getPackd · Anywhere — page-local behaviour (v2, after review feedback).
   The engine (scrollcraft.js) drives acts, the rail, reveals and fades.
   Bespoke here: the hero's cycling places (each photo depth-warped in WebGL),
   the four-field search (Where / When / Travelling as / Budget), the side-by-side
   board, and one shared query that every section and link follows.
   Every number is computed from data/market.json (the repo's real snapshot). */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const APP = new URLSearchParams(location.search).get("app") || "http://localhost:3000";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const short = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : `₹${Math.round(n / 1000)}k`);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const date = (s) => new Date(s + "T00:00:00");
  const dayMonth = (s) => { const d = date(s); return d.getDate() + " " + MONTHS[d.getMonth()]; };
  const shortDate = (s) => { const d = date(s); return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); };
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const say = (n) => (n <= 10 ? words[n] : String(n));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // same options as the app's own search bar (frontend/src/components/SearchBar.jsx)
  const PERSONAS = [["solo_woman", "Solo woman"], ["solo", "Solo"], ["friends", "Friends"], ["couple", "Couple"], ["senior", "Senior"]];
  const BUDGETS = [[null, 10000], [10000, 20000], [20000, 50000], [50000, 100000], [100000, null]];
  const budgetLabel = (lo, hi) => (lo && hi ? `${short(lo)} to ${short(hi)}` : hi ? `Under ${short(hi)}` : lo ? `${short(lo)} and up` : "Any budget");

  // the hero's places: real photos from the repo's destinations, each with a depth map
  const PLACES = [
    { slug: "ladakh", name: "Pangong Tso, Ladakh", w: 1920, h: 1280, fy: 0.72, mfx: 0.5 },
    { slug: "kerala", name: "Backwaters, Kerala", w: 1920, h: 1080, fy: 0.5, mfx: 0.72 },
    { slug: "rajasthan", name: "The Thar, Rajasthan", w: 1920, h: 1440, fy: 0.42, mfx: 0.12 },
    { slug: "kashmir", name: "Dal Lake, Kashmir", w: 1920, h: 1280, fy: 0.55, mfx: 0.45 },
    { slug: "meghalaya", name: "Living root bridge, Meghalaya", w: 1920, h: 1437, fy: 0.5, mfx: 0.5 },
    { slug: "spiti", name: "Spiti Valley", w: 1920, h: 1440, fy: 0.55, mfx: 0.95 },
  ];

  // reduced motion: the rail becomes a native sideways scroll region, so its pin must not hold extra scroll
  if (reduce) $("#operators").dataset.scSpan = "1.15";
  else if (innerWidth < 861) $("#operators").dataset.scSpan = "3.6";
  const sc = window.ScrollCraft.mount(document.body);
  const state = { dest: "", month: "", as: [], lo: null, hi: null };
  let M = null;
  const idx = {};

  /* ======================================================== data */
  fetch("data/market.json").then((r) => r.json()).then((data) => {
    M = data;
    derive();
    fillPickers();
    Finder.build();
    renderStatic();
    renderOps();
    applyQuery(true);
    Hero.counts();
    sc.layout && sc.layout();
    measure();
  }).catch((e) => console.error("[getpackd] market data failed to load", e));

  function derive() {
    const T = M.trips, D = M.departures;
    idx.destSlug = M.destinations.map(([s]) => s);
    idx.destName = Object.fromEntries(M.destinations.map(([s, n], i) => [i, n]));
    idx.byDest = {}; idx.byMonth = {};
    idx.opStats = M.operators.map(() => ({ deps: 0, trips: new Set(), dests: {} }));
    D.forEach((d, i) => {
      const t = T[d[0]], slug = idx.destSlug[t[2]], mo = d[1].slice(0, 7);
      (idx.byDest[slug] = idx.byDest[slug] || []).push(i);
      (idx.byMonth[mo] = idx.byMonth[mo] || []).push(i);
      const o = idx.opStats[t[1]]; o.deps++; o.trips.add(d[0]); o.dests[t[2]] = (o.dests[t[2]] || 0) + 1;
    });
    idx.months = Object.keys(idx.byMonth).sort();
    idx.dests = Object.keys(idx.byDest).map((slug) => [slug, destLabel(slug), idx.byDest[slug].length])
      .sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]));
  }
  const destLabel = (slug) => M.destinations[idx.destSlug.indexOf(slug)][1];
  const monthName = (m) => MONTHS[+m.slice(5) - 1];
  const monthLabel = (m) => `${monthName(m)} ${m.slice(0, 4)}`;

  // filters that the snapshot can answer: place, month, budget. ("Travelling as" goes to the app.)
  function matches(i, skip) {
    const d = M.departures[i], t = M.trips[d[0]];
    if (skip !== "dest" && state.dest && idx.destSlug[t[2]] !== state.dest) return false;
    if (skip !== "month" && state.month && d[1].slice(0, 7) !== state.month) return false;
    if (skip !== "budget" && ((state.lo && d[2] < state.lo) || (state.hi && d[2] >= state.hi))) return false;
    return true;
  }
  function selection(skip) { const out = []; for (let i = 0; i < M.departures.length; i++) if (matches(i, skip)) out.push(i); return out; }
  const opsIn = (list) => new Set(list.map((i) => M.trips[M.departures[i][0]][1])).size;

  function goHref() {
    const p = new URLSearchParams();
    if (state.dest) p.set("q", destLabel(state.dest));
    if (state.month) {
      const [y, m] = state.month.split("-").map(Number);
      p.set("start", `${state.month}-01`); p.set("end", `${state.month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`);
    }
    if (state.as.length) p.set("as", state.as.join(","));
    if (state.lo) p.set("min_price", state.lo);
    if (state.hi) p.set("max_price", state.hi);
    const qs = p.toString();
    return `${APP}/search${qs ? "?" + qs : ""}`;
  }

  /* ======================================================== native selects (bar + closing sentence) */
  function fillPickers() {
    $$('[data-pick="dest"]').forEach((sel) => idx.dests.forEach(([v, n]) => sel.add(new Option(n, v))));
    $$('[data-pick="month"]').forEach((sel) => idx.months.forEach((m) => sel.add(new Option(monthLabel(m), m))));
    $$("[data-pick]").forEach((sel) => sel.addEventListener("change", () => { state[sel.dataset.pick] = sel.value; applyQuery(false); }));
    $$("[data-query], [data-finder]").forEach((f) => f.addEventListener("submit", (e) => { e.preventDefault(); location.href = goHref(); }));
  }
  const meas = document.createElement("span");
  meas.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0";
  document.body.appendChild(meas);
  function fitSelect(sel) {
    const cs = getComputedStyle(sel);
    // longhands: the `font` shorthand serialises to "" when font-stretch is a percentage
    for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "letterSpacing", "fontVariationSettings"]) meas.style[k] = cs[k];
    meas.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
    sel.style.width = Math.ceil(meas.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2) + "px";
  }
  document.fonts && document.fonts.ready.then(() => $$("[data-pick]").forEach(fitSelect));

  /* ======================================================== the hero search (four fields, like the app's) */
  const Finder = (() => {
    const root = $("[data-finder]");
    let open = null;
    function lists() {
      // Where: counts follow the other filters
      const q = ($("[data-filter]", root).value || "").trim().toLowerCase();
      const pool = selection("dest");
      const per = {}; pool.forEach((i) => { const s = idx.destSlug[M.trips[M.departures[i][0]][2]]; per[s] = (per[s] || 0) + 1; });
      const dests = idx.dests.filter(([, n]) => !q || n.toLowerCase().includes(q));
      $('[data-list="dest"]', root).innerHTML =
        (q ? "" : `<button type="button" class="opt opt--strong" data-set="dest" data-val="" aria-pressed="${!state.dest}">Anywhere<small>${pool.length.toLocaleString("en-IN")}</small></button>`) +
        dests.map(([s, n]) => `<button type="button" class="opt" data-set="dest" data-val="${s}" aria-pressed="${state.dest === s}">${esc(n)}<small>${per[s] || 0}</small></button>`).join("") +
        (dests.length ? "" : `<p class="pop__note">No place by that name in this snapshot.</p>`);
      const mp = selection("month"), mc = {}; mp.forEach((i) => { const m = M.departures[i][1].slice(0, 7); mc[m] = (mc[m] || 0) + 1; });
      $('[data-list="month"]', root).innerHTML =
        `<button type="button" class="chip chip--all" data-set="month" data-val="" aria-pressed="${!state.month}">Any dates<small>${mp.length.toLocaleString("en-IN")} departures</small></button>` +
        idx.months.map((m) => `<button type="button" class="chip" data-set="month" data-val="${m}" aria-pressed="${state.month === m}">${monthLabel(m)}<small>${mc[m] || 0} departures</small></button>`).join("");
      $('[data-list="as"]', root).innerHTML = PERSONAS.map(([v, l]) => `<button type="button" class="chip" data-toggle="as" data-val="${v}" aria-pressed="${state.as.includes(v)}">${l}</button>`).join("");
      const bp = selection("budget");
      const inB = (lo, hi) => bp.filter((i) => { const p = M.departures[i][2]; return (!lo || p >= lo) && (!hi || p < hi); }).length;
      $('[data-list="budget"]', root).innerHTML =
        `<button type="button" class="chip chip--all" data-set="budget" data-val="" aria-pressed="${!state.lo && !state.hi}">Any budget<small>${bp.length.toLocaleString("en-IN")} departures</small></button>` +
        BUDGETS.map(([lo, hi]) => `<button type="button" class="chip" data-set="budget" data-val="${lo || ""}-${hi || ""}" aria-pressed="${(state.lo || null) === lo && (state.hi || null) === hi}">${budgetLabel(lo, hi)}<small>${inB(lo, hi)} departures</small></button>`).join("");
    }
    function labels() {
      $('[data-v="dest"]', root).textContent = state.dest ? destLabel(state.dest) : "Anywhere";
      $('[data-v="month"]', root).textContent = state.month ? monthLabel(state.month) : "Any dates";
      $('[data-v="as"]', root).textContent = state.as.length ? state.as.map((a) => PERSONAS.find((p) => p[0] === a)[1]).join(", ") : "Anyone";
      $('[data-v="budget"]', root).textContent = budgetLabel(state.lo, state.hi);
    }
    function show(btn) {
      if (open && open.btn === btn) return hide(true);
      hide(false);
      const pop = document.getElementById(btn.getAttribute("aria-controls"));
      lists();
      pop.hidden = false; btn.setAttribute("aria-expanded", "true");
      open = { btn, pop };
      const first = pop.querySelector("input, [aria-pressed='true'], button");
      first && first.focus({ preventScroll: true });
    }
    function hide(refocus) {
      if (!open) return;
      open.pop.hidden = true; open.btn.setAttribute("aria-expanded", "false");
      if (refocus) open.btn.focus({ preventScroll: true });
      open = null;
    }
    function build() {
      $$(".ff", root).forEach((b) => b.addEventListener("click", () => show(b)));
      $("[data-filter]", root).addEventListener("input", lists);
      root.addEventListener("click", (e) => {
        const b = e.target.closest("[data-set], [data-toggle]"); if (!b) return;
        const k = b.dataset.set || b.dataset.toggle, v = b.dataset.val;
        if (k === "dest") state.dest = v;
        if (k === "month") state.month = v;
        if (k === "budget") { const [lo, hi] = v.split("-"); state.lo = lo ? +lo : null; state.hi = hi ? +hi : null; }
        if (k === "as") state.as = state.as.includes(v) ? state.as.filter((x) => x !== v) : [...state.as, v];
        applyQuery(false);
        if (b.dataset.set) hide(true); else lists();
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) hide(true); });
      document.addEventListener("pointerdown", (e) => { if (open && !e.target.closest(".finder__f")) hide(false); });
      lists(); labels();
    }
    return { build, labels, lists: () => open && lists() };
  })();

  /* ======================================================== everything follows the query */
  function renderStatic() {
    const set = (k, v) => $$(`[data-n="${k}"]`).forEach((el) => (el.textContent = v));
    const snap = date(M.snapshot);
    set("operators", M.operators.length);
    set("snapshot", `${snap.getDate()} ${MONTHS[snap.getMonth()]} ${snap.getFullYear()}`);
    set("gst", M.gst_extra_trips != null ? M.gst_extra_trips : "116");
  }

  function applyQuery(first) {
    $$("[data-pick]").forEach((sel) => { if (sel.value !== state[sel.dataset.pick]) sel.value = state[sel.dataset.pick]; fitSelect(sel); });
    const sel = selection(), n = sel.length, ops = opsIn(sel), href = goHref();
    $$("[data-go]").forEach((a) => (a.href = href));
    $$("[data-count-short]").forEach((el) => (el.textContent = n.toLocaleString("en-IN")));
    $$("[data-go-label]").forEach((el) => (el.textContent = n ? `Show ${n.toLocaleString("en-IN")} departures` : "Show departures"));
    const where = state.dest ? ` to ${destLabel(state.dest)}` : "", when = state.month ? ` in ${monthName(state.month)}` : "";
    const price = state.lo || state.hi ? `, ${budgetLabel(state.lo, state.hi).toLowerCase()}` : "";
    $$("[data-count-long]").forEach((el) => {
      el.innerHTML = n
        ? `<b class="num">${n.toLocaleString("en-IN")}</b> departure${n === 1 ? "" : "s"}${where}${when}${price} from <b class="num">${ops}</b> operator${ops === 1 ? "" : "s"}.`
        : `No departures${where}${when}${price} in this snapshot yet. Try another month or budget.`;
    });
    Finder.labels(); Finder.lists();
    renderSide(first);
    Hero.follow(state.dest);
  }

  /* ======================================================== side by side */
  function compareFor(slug, month) {
    const list = (idx.byDest[slug] || []).filter((i) => !month || M.departures[i][1].slice(0, 7) === month);
    if (!list.length) return null;
    const byDate = {};
    list.forEach((i) => { const d = M.departures[i]; (byDate[d[1]] = byDate[d[1]] || []).push(i); });
    let best = null, bestOps = 0;
    Object.keys(byDate).sort().forEach((s) => { const k = opsIn(byDate[s]); if (k > bestOps) { best = s; bestOps = k; } });
    let rows, mode;
    if (bestOps >= 3) {
      const m = new Map();
      byDate[best].forEach((i) => { const d = M.departures[i], op = M.trips[d[0]][1]; if (!m.has(op) || d[2] < M.departures[m.get(op)][2]) m.set(op, i); });
      rows = [...m.values()]; mode = "day";
    } else {
      const m = new Map();
      list.slice().sort((a, b) => M.departures[a][1].localeCompare(M.departures[b][1])).forEach((i) => { const op = M.trips[M.departures[i][0]][1]; if (!m.has(op)) m.set(op, i); });
      rows = [...m.values()].slice(0, 8); mode = "next";
    }
    return { slug, place: destLabel(slug), date: best, mode, rows, total: list.length, ops: opsIn(list) };
  }

  let boardShown = false;
  function renderSide(first) {
    const slug = state.dest || "spiti";
    const C = compareFor(slug, state.month);
    const t = (k, v) => ($(`[data-side="${k}"]`).textContent = v);
    const board = $("[data-board]");
    if (!C) {
      t("eyebrow", destLabel(slug));
      t("title", "Nothing on sale for that month yet.");
      t("body", `${destLabel(slug)} has no departures${state.month ? " in " + monthName(state.month) : ""} in this snapshot. Leave When on Any dates to see every date.`);
      $('[data-side="gap"]').parentElement.hidden = true;
      board.innerHTML = `<li class="board__empty">No departures to compare.</li>`;
      t("foot", "");
      return;
    }
    $('[data-side="gap"]').parentElement.hidden = false;
    const n = C.rows.length;
    const rows = C.rows.map((i) => { const d = M.departures[i], tr = M.trips[d[0]]; return { i, op: M.operators[tr[1]], title: tr[0], days: tr[3], price: d[2], start: d[1], perDay: d[2] / Math.max(1, tr[3]) }; });
    const lo = Math.min(...rows.map((r) => r.price)), hi = Math.max(...rows.map((r) => r.price));
    t("eyebrow", state.dest ? C.place : `For example, ${C.place}`);
    if (C.mode === "day") {
      const wd = DAYS[date(C.date).getDay()];
      t("title", `Same ${/valley/i.test(C.place) ? "valley" : "place"}. Same ${wd}. ${cap(say(n))} prices.`);
      t("body", `On ${wd} ${dayMonth(C.date)}, ${say(n)} operators leave for ${C.place}. Here they are side by side, cheapest first.`);
      t("gapl", "between the cheapest and the dearest, leaving the same day for the same place.");
    } else {
      const all = n === C.ops, inMonth = state.month ? " in " + monthName(state.month) : "";
      t("title", all ? `${C.place}, from every operator.` : `${C.place}, operator by operator.`);
      t("body", all ? `The next departure${inMonth} from each of the ${say(n)} operators going to ${C.place}, cheapest first.`
                    : `The next departure${inMonth} from ${say(n)} of the ${C.ops} operators going to ${C.place}, cheapest first.`);
      t("gapl", "between the cheapest and the dearest next departure.");
    }
    t("gap", inr(hi - lo));
    t("foot", `Trips differ in length and in what they include, so the price per day is shown too. ${C.place} has ${C.total} departures from ${C.ops} operators in this snapshot.`);
    const alpha = rows.slice().sort((a, b) => a.op.localeCompare(b.op)), byPrice = rows.slice().sort((a, b) => a.price - b.price);
    const li = (r) => `<li class="row${r.price === lo ? " is-low" : ""}" data-i="${r.i}">
        <span class="row__op">${esc(r.op)}</span>
        <span class="row__trip">${esc(r.title)} · ${r.days} days${C.mode === "next" ? " · " + shortDate(r.start) : ""}</span>
        <span class="row__bar" aria-hidden="true"><i style="--w:${(r.price / hi).toFixed(3)}"></i></span>
        <span class="row__price">${inr(r.price)}</span>
        <span class="row__day">${inr(r.perDay)} a day</span></li>`;
    if (first && !reduce) { board.innerHTML = alpha.map(li).join(""); board.classList.add("is-waiting"); watchBoard(byPrice); }
    else { board.innerHTML = byPrice.map(li).join(""); board.classList.remove("is-waiting"); }
    if (boardShown) board.classList.remove("is-waiting");
  }
  // FLIP: rows land in operator order, then sort themselves by price
  function watchBoard(byPrice) {
    const board = $("[data-board]");
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect(); boardShown = true;
      setTimeout(() => {
        const els = $$(".row", board);
        const first = new Map(els.map((el) => [el.dataset.i, el.getBoundingClientRect().top]));
        byPrice.forEach((r) => { const el = board.querySelector(`[data-i="${r.i}"]`); if (el) board.appendChild(el); });
        els.forEach((el) => {
          const dy = first.get(el.dataset.i) - el.getBoundingClientRect().top; if (!dy) return;
          el.style.transform = `translate3d(0,${dy}px,0)`;
          requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = "transform 760ms cubic-bezier(0.23, 1, 0.32, 1)"; el.style.transform = "translate3d(0,0,0)"; }));
        });
        board.classList.remove("is-waiting");
      }, 520);
    }, { rootMargin: "0px 0px -22% 0px" });
    io.observe(board);
  }

  /* ======================================================== operators */
  function renderOps() {
    const order = idx.opStats.map((o, i) => [i, o]).sort((a, b) => b[1].deps - a[1].deps || M.operators[a[0]].localeCompare(M.operators[b[0]]));
    $("[data-ops]").innerHTML = order.map(([i, o]) => {
      const top = Object.entries(o.dests).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => idx.destName[d]);
      return `<article class="op"><h3>${esc(M.operators[i])}</h3><p><b>${o.deps}</b> departure${o.deps === 1 ? "" : "s"} · <b>${o.trips.size}</b> trip${o.trips.size === 1 ? "" : "s"}<br>${esc(top.join(", "))}</p></article>`;
    }).join("");
  }

  /* ======================================================== layout */
  const L = { vw: innerWidth, vh: innerHeight, heroH: innerHeight };
  function measure() {
    L.vw = innerWidth; L.vh = innerHeight; L.heroH = $("#hero").offsetHeight;
    Hero.resize(); kick();
  }
  addEventListener("resize", () => { clearTimeout(measure.t); measure.t = setTimeout(measure, 120); });
  addEventListener("load", measure);
  let lastMainH = 0;
  new ResizeObserver(() => {
    const h = document.querySelector("main").offsetHeight;
    if (Math.abs(h - lastMainH) < 2) return;
    lastMainH = h; clearTimeout(measure.r);
    measure.r = setTimeout(() => { sc.layout && sc.layout(); measure(); }, 60);
  }).observe(document.querySelector("main"));

  /* ======================================================== the hero: places, depth-warped */
  const Hero = (() => {
    const cv = $("#scene"), fb = $(".scene-fallback"), hero = $("#hero");
    const nameEl = $("[data-place-name]"), metaEl = $("[data-place-meta]"), placeBtn = $("[data-place]"), dots = $("[data-dots]");
    const HOLD = 6500, XF = 1400;
    let gl = null, prog = null, U = {}, ok = false, dpr = 1;
    const tex = new Map();          // slug -> { t, d } textures
    const loading = new Map();
    let cur = 0, nxt = -1, tCur = performance.now(), tNxt = 0, xfStart = 0;
    // paused: the visitor's choice (or reduced motion). pinned: keyboard focus is inside the hero.
    let paused = reduce, pinned = false, heldLife = 0, wasHeld = false, followPaused = false;
    const m = { x: 0, y: 0, tx: 0, ty: 0 };

    const VS = `#version 300 es
      in vec2 a; out vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
    const FS = `#version 300 es
      precision highp float;
      uniform sampler2D uA, uAd, uB, uBd;
      uniform vec2 uRes; uniform vec4 uCovA, uCovB; uniform vec2 uC;
      uniform float uZA, uPA, uZB, uPB, uMix; uniform vec2 uM;
      in vec2 v; out vec4 o;
      vec3 slide(sampler2D t, sampler2D dm, vec4 cov, float z, float pz, vec2 q) {
        vec2 p = uC + (q - uC) / (1.0 + z);
        for (int i = 0; i < 3; i++) {
          float d = texture(dm, clamp((p - cov.xy) / cov.zw, 0.0, 1.0)).r;
          p = uC + (q - uM * (0.2 + d * 1.4) - uC) / (1.0 + z + pz * d);
        }
        return texture(t, clamp((p - cov.xy) / cov.zw, 0.0005, 0.9995)).rgb;
      }
      void main(){
        vec2 q = vec2(v.x, 1.0 - v.y) * uRes;
        vec3 c = slide(uA, uAd, uCovA, uZA, uPA, q);
        if (uMix > 0.001) c = mix(c, slide(uB, uBd, uCovB, uZB, uPB, q), uMix);
        o = vec4(c, 1.0);
      }`;

    const isPhone = () => L.vw < 861 || L.vw / L.vh < 0.9;
    function cover(P) {
      const s = Math.max(L.vw / P.w, L.vh / P.h), w = P.w * s, h = P.h * s;
      return [(L.vw - w) * (isPhone() ? P.mfx : 0.5), (L.vh - h) * (isPhone() ? 0.5 : P.fy), w, h];
    }
    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function upload(img) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
      return t;
    }
    const img = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => (i.decode ? i.decode().then(() => res(i), () => res(i)) : res(i)); i.onerror = rej; i.src = src; });
    function ensure(k) {
      const P = PLACES[k];
      if (tex.has(P.slug) || !ok) return Promise.resolve();
      if (loading.has(P.slug)) return loading.get(P.slug);
      const job = Promise.all([img(`assets/places/${P.slug}.jpg`), img(`assets/places/${P.slug}-depth.png`)]).then(([a, d]) => {
        tex.set(P.slug, { t: upload(a), d: upload(d) });
        // keep at most four places on the GPU
        if (tex.size > 4) for (const [s, v] of tex) { if (s !== PLACES[cur].slug && (nxt < 0 || s !== PLACES[nxt].slug) && s !== P.slug) { gl.deleteTexture(v.t); gl.deleteTexture(v.d); tex.delete(s); break; } }
      });
      loading.set(P.slug, job); job.finally(() => loading.delete(P.slug));
      return job;
    }
    function fail(e) {
      if (e) console.warn("[getpackd] WebGL unavailable, using stills", e);
      document.documentElement.classList.add("no-gl"); ok = false;
      fb.innerHTML = PLACES.map((P, i) => `<img src="assets/places/${P.slug}.jpg" alt="" ${i ? 'loading="lazy"' : ""} style="object-position:${isPhone() ? P.mfx * 100 : 50}% ${isPhone() ? 50 : P.fy * 100}%">`).join("");
      fb.children[cur] && fb.children[cur].classList.add("on");
    }
    async function init() {
      dots.innerHTML = PLACES.map((P, i) => `<button type="button" data-k="${i}" aria-label="Show ${esc(P.name)}" aria-current="${i === 0}"><i></i></button>`).join("") +
        `<button type="button" class="pause" data-pause aria-label="${paused ? "Play places" : "Pause places"}"><svg class="ico" aria-hidden="true"><use href="#i-${paused ? "play" : "pause"}"/></svg></button>`;
      dots.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-pause")) { paused = !paused; followPaused = false; syncPause(); kick(); return; }
        go(+b.dataset.k, true);
      });
      placeBtn.addEventListener("click", () => { state.dest = PLACES[nxt >= 0 ? nxt : cur].slug; applyQuery(false); });
      // keyboard users get a still hero while they are inside it (carousel pause on focus)
      hero.addEventListener("focusin", () => (pinned = true)); hero.addEventListener("focusout", () => (pinned = false));
      caption(0);
      try {
        gl = cv.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
        if (!gl) return fail();
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ["uA", "uAd", "uB", "uBd", "uRes", "uCovA", "uCovB", "uC", "uZA", "uPA", "uZB", "uPB", "uMix", "uM"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
        ok = true; resize();
        await ensure(0); tCur = performance.now(); kick();
        ensure(1);
      } catch (e) { fail(e); }
    }
    function syncPause() {
      const b = $("[data-pause]", dots); if (!b) return;
      b.setAttribute("aria-label", paused ? "Play places" : "Pause places");
      b.querySelector("use").setAttribute("href", paused ? "#i-play" : "#i-pause");
    }
    function caption(k) {
      const P = PLACES[k];
      nameEl.textContent = P.name;
      if (M) { const l = idx.byDest[P.slug] || []; metaEl.textContent = l.length ? ` · ${l.length} departures from ${opsIn(l)} operators` : ""; }
      placeBtn.setAttribute("aria-label", `${P.name}${metaEl.textContent}. Search departures here.`);
      $$("button[data-k]", dots).forEach((b) => b.setAttribute("aria-current", String(+b.dataset.k === k)));
      if (!ok && fb.children.length) [...fb.children].forEach((c, i) => c.classList.toggle("on", i === k));
    }
    function go(k) {
      if (k === cur && nxt < 0) return;
      if (!ok) { cur = k; caption(k); return; }
      ensure(k).then(() => {
        if (nxt >= 0) { cur = nxt; tCur = tNxt; }   // a click mid-crossfade lands the one in flight first
        if (k === cur) { nxt = -1; caption(k); return; }
        nxt = k; tNxt = performance.now(); xfStart = tNxt; caption(k); kick();
      });
    }
    // picking a hero place in Where shows that place and holds it; back to Anywhere resumes
    function follow(slug) {
      const k = PLACES.findIndex((P) => P.slug === slug);
      if (k >= 0) { go(k); if (!paused) { paused = true; followPaused = true; syncPause(); } }
      else if (followPaused) { paused = false; followPaused = false; syncPause(); kick(); }
    }
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      cv.width = Math.round(L.vw * dpr); cv.height = Math.round(L.vh * dpr);
      if (ok) gl.viewport(0, 0, cv.width, cv.height);
    }
    function pointer(x, y) { m.tx = x; m.ty = y; }
    function bind(unitT, unitD, slug) {
      const T = tex.get(slug); if (!T) return false;
      gl.activeTexture(gl.TEXTURE0 + unitT); gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.activeTexture(gl.TEXTURE0 + unitD); gl.bindTexture(gl.TEXTURE_2D, T.d);
      return true;
    }
    // returns true while it needs more frames
    function frame(now, scrollFrac) {
      const visible = scrollFrac < 1;
      cv.style.visibility = visible ? "visible" : "hidden";
      const hold = paused || pinned || !visible || document.hidden;
      // while held, the current place's clock stops (no advance, no further push-in)
      if (hold) { if (!wasHeld) heldLife = now - tCur; tCur = now - heldLife; }
      wasHeld = hold;
      if (nxt < 0 && !hold && now - tCur > HOLD) { const k = (cur + 1) % PLACES.length; if (tex.has(PLACES[k].slug)) go(k); else ensure(k); }
      let mix = 0;
      if (nxt >= 0) {
        mix = smooth((now - xfStart) / XF);
        if (mix >= 1) { cur = nxt; tCur = tNxt; nxt = -1; mix = 0; ensure((cur + 1) % PLACES.length); }
      }
      if (!ok || !visible) return !hold;
      m.x += (m.tx - m.x) * 0.07; m.y += (m.ty - m.y) * 0.07;
      const life = (t0) => (reduce ? 0 : clamp((now - t0) / (HOLD + XF)));
      const push = reduce ? 0 : smooth(scrollFrac) * 0.09;
      const zA = 0.035 + life(tCur) * 0.05 + push, pA = (reduce ? 0 : 0.05 + life(tCur) * 0.07) + push * 1.4;
      if (!bind(0, 1, PLACES[cur].slug)) return true;
      const cA = cover(PLACES[cur]);
      gl.uniform1i(U.uA, 0); gl.uniform1i(U.uAd, 1);
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform4f(U.uCovA, cA[0] * dpr, cA[1] * dpr, cA[2] * dpr, cA[3] * dpr);
      gl.uniform2f(U.uC, L.vw * 0.5 * dpr, L.vh * 0.58 * dpr);
      gl.uniform1f(U.uZA, zA); gl.uniform1f(U.uPA, pA);
      if (nxt >= 0 && bind(2, 3, PLACES[nxt].slug)) {
        const cB = cover(PLACES[nxt]);
        gl.uniform1i(U.uB, 2); gl.uniform1i(U.uBd, 3);
        gl.uniform4f(U.uCovB, cB[0] * dpr, cB[1] * dpr, cB[2] * dpr, cB[3] * dpr);
        gl.uniform1f(U.uZB, 0.035 + life(tNxt) * 0.05 + push); gl.uniform1f(U.uPB, (reduce ? 0 : 0.05 + life(tNxt) * 0.07) + push * 1.4);
        gl.uniform1f(U.uMix, mix);
      } else gl.uniform1f(U.uMix, 0);
      gl.uniform2f(U.uM, m.x * 12 * dpr, m.y * 8 * dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      hero.setAttribute("data-sc-verify-state", `${cur}|${nxt}|${mix.toFixed(2)}|${push.toFixed(3)}`);
      return !reduce || nxt >= 0 || Math.abs(m.tx - m.x) > 0.002;
    }
    init();
    return { frame, resize, pointer, follow, counts: () => caption(nxt >= 0 ? nxt : cur) };
  })();

  /* ======================================================== frame loop */
  let raf = 0;
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  addEventListener("scroll", kick, { passive: true });
  if (fine && !reduce) addEventListener("pointermove", (e) => { Hero.pointer((e.clientX / L.vw - 0.5) * 2, (e.clientY / L.vh - 0.5) * 2); kick(); }, { passive: true });
  document.addEventListener("visibilitychange", kick);
  function loop(now) {
    raf = 0;
    const frac = clamp(scrollY / Math.max(L.heroH, 1));
    document.documentElement.classList.toggle("is-past", scrollY > L.heroH * 0.72);
    const more = Hero.frame(now, frac);
    if (more && frac < 1) kick();
    else if (frac < 1) setTimeout(kick, 400); // held: check back gently for a resume
  }
  measure();
  kick();
})();

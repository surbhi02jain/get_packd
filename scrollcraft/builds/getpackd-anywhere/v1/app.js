/* getPackd · Anywhere — page-local behaviour.
   The engine (scrollcraft.js) drives acts, cues, the rail and the reveal.
   Everything bespoke lives here: the depth-warped gate, the sky of departures,
   the side-by-side board, and the one Where/When query that re-points them all.
   Every number shown is computed from data/market.json (the repo's real snapshot). */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const APP = new URLSearchParams(location.search).get("app") || "http://localhost:3000";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const date = (s) => new Date(s + "T00:00:00");
  const dayMonth = (s) => { const d = date(s); return d.getDate() + " " + MONTHS[d.getMonth()]; };
  const shortDate = (s) => { const d = date(s); return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); };
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const say = (n) => (n <= 10 ? words[n] : String(n));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Reduced motion: no extra pinned scroll, the same story at rest.
  if (reduce) { $("#gate").dataset.scSpan = "1.2"; $("#market").dataset.scSpan = "1.5"; }
  // a phone's rail is long relative to its width: give the hand more room so it reads as a drawer, not a blur
  else if (innerWidth < 861) $("#operators").dataset.scSpan = "3.6";
  const sc = window.ScrollCraft.mount(document.body);

  const state = { dest: "", month: "" };
  let M = null;               // market data
  const idx = {};             // derived lookups

  /* ======================================================== data + query */
  fetch("data/market.json").then((r) => r.json()).then((data) => {
    M = data;
    derive();
    fillPickers();
    renderStatic();
    renderOps();
    applyQuery(true);
    Sky.build();
    sc.layout && sc.layout();
    measure();
    kick();
  }).catch((e) => console.error("[getpackd] market data failed to load", e));

  function derive() {
    const T = M.trips, D = M.departures;
    idx.destName = Object.fromEntries(M.destinations.map(([s, n], i) => [i, n]));
    idx.destSlug = M.destinations.map(([s]) => s);
    idx.byDest = {}; idx.byMonth = {}; idx.opStats = M.operators.map(() => ({ deps: 0, trips: new Set(), dests: {} }));
    D.forEach((d, i) => {
      const t = T[d[0]], slug = idx.destSlug[t[2]], mo = d[1].slice(0, 7);
      (idx.byDest[slug] = idx.byDest[slug] || []).push(i);
      (idx.byMonth[mo] = idx.byMonth[mo] || []).push(i);
      const o = idx.opStats[t[1]]; o.deps++; o.trips.add(d[0]); o.dests[t[2]] = (o.dests[t[2]] || 0) + 1;
    });
    idx.months = Object.keys(idx.byMonth).sort();
    idx.first = D.reduce((a, d) => (d[1] < a ? d[1] : a), D[0][1]);
    idx.last = D.reduce((a, d) => (d[1] > a ? d[1] : a), D[0][1]);
  }

  function fillPickers() {
    const dests = Object.keys(idx.byDest).map((slug) => [slug, M.destinations[idx.destSlug.indexOf(slug)][1], idx.byDest[slug].length])
      .sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]));
    const months = idx.months.map((m) => { const [y, mo] = m.split("-"); return [m, MONTHS[+mo - 1] + " " + y, idx.byMonth[m].length]; });
    $$('[data-pick="dest"]').forEach((sel) => {
      const plain = !!sel.closest(".ask");
      dests.forEach(([v, n]) => sel.add(new Option(n, v)));
    });
    $$('[data-pick="month"]').forEach((sel) => {
      const plain = !!sel.closest(".ask");
      months.forEach(([v, n]) => sel.add(new Option(n, v)));
    });
    $$("[data-pick]").forEach((sel) => sel.addEventListener("change", () => {
      state[sel.dataset.pick] = sel.value;
      applyQuery(false);
    }));
    $$("[data-query]").forEach((f) => f.addEventListener("submit", (e) => { e.preventDefault(); location.href = goHref(); }));
  }

  function matches(i) {
    const d = M.departures[i], t = M.trips[d[0]];
    if (state.dest && idx.destSlug[t[2]] !== state.dest) return false;
    if (state.month && d[1].slice(0, 7) !== state.month) return false;
    return true;
  }
  function selection() {
    const out = [];
    for (let i = 0; i < M.departures.length; i++) if (matches(i)) out.push(i);
    return out;
  }
  function opsIn(list) { return new Set(list.map((i) => M.trips[M.departures[i][0]][1])).size; }
  const destLabel = (slug) => M.destinations[idx.destSlug.indexOf(slug)][1];
  const monthLabel = (m) => { const [y, mo] = m.split("-"); return MONTHS[+mo - 1]; };

  function goHref() {
    const p = new URLSearchParams();
    if (state.dest) p.set("q", destLabel(state.dest));
    if (state.month) {
      const [y, m] = state.month.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      p.set("start", `${state.month}-01`); p.set("end", `${state.month}-${String(last).padStart(2, "0")}`);
    }
    const qs = p.toString();
    return `${APP}/search${qs ? "?" + qs : ""}`;
  }

  function renderStatic() {
    const set = (k, v) => $$(`[data-n="${k}"]`).forEach((el) => (el.textContent = v));
    const snap = date(M.snapshot);
    set("operators", M.operators.length);
    set("snapshot", `${snap.getDate()} ${MONTHS[snap.getMonth()]} ${snap.getFullYear()}`);
    const lad = idx.byDest.ladakh || [];
    set("ladakh-deps", lad.length); set("ladakh-ops", opsIn(lad));
    const beat = $(".gate__beat p:last-child");
    beat.innerHTML = `<b class="num">${lad.length}</b> departures to Ladakh from <b class="num">${opsIn(lad)}</b> operators, as of ${dayMonth(M.snapshot)}.`;
    // trips that state GST is extra, recorded by the data builder as price uplift
    set("gst", M.gst_extra_trips != null ? M.gst_extra_trips : "116");
    // market month table for screen readers
    const tb = $('[data-mk="table"] tbody');
    tb.innerHTML = idx.months.map((m) => {
      const l = idx.byMonth[m]; const lo = Math.min(...l.map((i) => M.departures[i][2]));
      return `<tr><td>${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</td><td>${l.length}</td><td>${inr(lo)}</td></tr>`;
    }).join("");
    $('[data-mk="hint"]').textContent = fine ? "Hover any one to see it." : "Tap any one to see it.";
  }

  function applyQuery(first) {
    $$("[data-pick]").forEach((sel) => { if (sel.value !== state[sel.dataset.pick]) sel.value = state[sel.dataset.pick]; fitSelect(sel); });
    const sel = selection();
    const n = sel.length, ops = opsIn(sel);
    const href = goHref();
    $$("[data-go]").forEach((a) => (a.href = href));
    $$("[data-count-short]").forEach((el) => (el.textContent = n.toLocaleString("en-IN")));
    const where = state.dest ? ` to ${destLabel(state.dest)}` : "";
    const when = state.month ? ` in ${monthLabel(state.month)}` : "";
    $$("[data-count-long]").forEach((el) => {
      el.innerHTML = n
        ? `<b class="num">${n.toLocaleString("en-IN")}</b> departure${n === 1 ? "" : "s"}${where}${when} from <b class="num">${ops}</b> operator${ops === 1 ? "" : "s"}.`
        : `No departures${where}${when} in this snapshot yet. Try another month.`;
    });
    renderSide(first);
    renderMarketCopy(sel);
    Sky.paint();
    kick();
  }

  /* ======================================================== 2 · side by side */
  function compareFor(slug, month) {
    const list = (idx.byDest[slug] || []).filter((i) => !month || M.departures[i][1].slice(0, 7) === month);
    if (!list.length) return null;
    // the start date with the most distinct operators (earliest on ties)
    const byDate = {};
    list.forEach((i) => { const d = M.departures[i]; (byDate[d[1]] = byDate[d[1]] || []).push(i); });
    let best = null, bestOps = 0;
    Object.keys(byDate).sort().forEach((s) => { const k = opsIn(byDate[s]); if (k > bestOps) { best = s; bestOps = k; } });
    let rows, mode;
    const pickPerOp = (ids) => {
      const m = new Map();
      ids.forEach((i) => { const d = M.departures[i], op = M.trips[d[0]][1]; if (!m.has(op) || d[2] < M.departures[m.get(op)][2]) m.set(op, i); });
      return [...m.values()];
    };
    if (bestOps >= 3) { rows = pickPerOp(byDate[best]); mode = "day"; }
    else {
      // otherwise: each operator's next departure
      const m = new Map();
      list.slice().sort((a, b) => M.departures[a][1].localeCompare(M.departures[b][1])).forEach((i) => {
        const op = M.trips[M.departures[i][0]][1]; if (!m.has(op)) m.set(op, i);
      });
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
      t("body", `${destLabel(slug)} has no departures${state.month ? " in " + monthLabel(state.month) : ""} in this snapshot. Leave When on Any month to see every date.`);
      t("gap", "₹0"); $('[data-side="gap"]').parentElement.hidden = true;
      board.innerHTML = `<li class="board__empty">No departures to compare.</li>`;
      t("foot", "");
      return;
    }
    $('[data-side="gap"]').parentElement.hidden = false;
    const n = C.rows.length;
    const rows = C.rows.map((i) => {
      const d = M.departures[i], tr = M.trips[d[0]];
      return { i, op: M.operators[tr[1]], title: tr[0], days: tr[3], price: d[2], start: d[1], perDay: d[2] / Math.max(1, tr[3]) };
    });
    const lo = Math.min(...rows.map((r) => r.price)), hi = Math.max(...rows.map((r) => r.price));
    t("eyebrow", state.dest ? C.place : `For example, ${C.place}`);
    if (C.mode === "day") {
      const wd = DAYS[date(C.date).getDay()];
      t("title", `Same ${/valley/i.test(C.place) ? "valley" : "place"}. Same ${wd}. ${cap(say(n))} prices.`);
      t("body", `On ${wd} ${dayMonth(C.date)}, ${say(n)} operators leave for ${C.place}. Here they are side by side, cheapest first.`);
      t("gapl", "between the cheapest and the dearest, leaving the same day for the same place.");
    } else {
      const all = n === C.ops, inMonth = state.month ? " in " + monthLabel(state.month) : "";
      t("title", all ? `${C.place}, from every operator.` : `${C.place}, operator by operator.`);
      t("body", all
        ? `The next departure${inMonth} from each of the ${say(n)} operators going to ${C.place}, cheapest first.`
        : `The next departure${inMonth} from ${say(n)} of the ${C.ops} operators going to ${C.place}, cheapest first.`);
      t("gapl", "between the cheapest and the dearest next departure.");
    }
    t("gap", inr(hi - lo));
    t("foot", `Trips differ in length and in what they include, so the price per day is shown too. ${C.place} has ${C.total} departures from ${C.ops} operators in this snapshot.`);

    const alpha = rows.slice().sort((a, b) => a.op.localeCompare(b.op));
    const byPrice = rows.slice().sort((a, b) => a.price - b.price);
    const li = (r) => `<li class="row${r.price === lo ? " is-low" : ""}" data-i="${r.i}">
        <span class="row__op">${esc(r.op)}</span>
        <span class="row__trip">${esc(r.title)} · ${r.days} days${C.mode === "next" ? " · " + shortDate(r.start) : ""}</span>
        <span class="row__bar" aria-hidden="true"><i style="--w:${(r.price / hi).toFixed(3)}"></i></span>
        <span class="row__price">${inr(r.price)}</span>
        <span class="row__day">${inr(r.perDay)} a day</span></li>`;
    if (first && !reduce) {
      board.innerHTML = alpha.map(li).join("");
      board.classList.add("is-waiting");
      watchBoard(byPrice);
    } else {
      board.innerHTML = byPrice.map(li).join("");
      board.classList.remove("is-waiting");
    }
    if (boardShown) board.classList.remove("is-waiting");
  }
  // a native select is as wide as its longest option; size it to the chosen one
  const meas = document.createElement("span");
  meas.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0";
  document.body.appendChild(meas);
  function fitSelect(sel) {
    const cs = getComputedStyle(sel);
    // longhands: the `font` shorthand serialises to "" when font-stretch is a percentage
    for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "letterSpacing", "fontVariationSettings"]) meas.style[k] = cs[k];
    meas.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2;
    sel.style.width = Math.ceil(meas.getBoundingClientRect().width + pad) + "px";
  }
  document.fonts && document.fonts.ready.then(() => $$("[data-pick]").forEach(fitSelect));
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // FLIP: rows land in operator order, then sort themselves by price.
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
          const dy = first.get(el.dataset.i) - el.getBoundingClientRect().top;
          if (!dy) return;
          el.style.transform = `translate3d(0,${dy}px,0)`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transition = "transform 760ms cubic-bezier(0.23, 1, 0.32, 1)";
            el.style.transform = "translate3d(0,0,0)";
          }));
        });
        board.classList.remove("is-waiting");
      }, 520);
    }, { rootMargin: "0px 0px -22% 0px" });
    io.observe(board);
  }

  /* ======================================================== 5 · operators */
  function renderOps() {
    const order = idx.opStats.map((o, i) => [i, o]).sort((a, b) => b[1].deps - a[1].deps || M.operators[a[0]].localeCompare(M.operators[b[0]]));
    $("[data-ops]").innerHTML = order.map(([i, o]) => {
      const top = Object.entries(o.dests).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => idx.destName[d]);
      return `<article class="op"><h3>${esc(M.operators[i])}</h3>
        <p><b>${o.deps}</b> departure${o.deps === 1 ? "" : "s"} · <b>${o.trips.size}</b> trip${o.trips.size === 1 ? "" : "s"}<br>${esc(top.join(", "))}</p></article>`;
    }).join("");
  }

  /* ======================================================== 4 · market copy */
  function renderMarketCopy(sel) {
    const n = sel.length;
    selCount = n; lastCount = -1;
    $('[data-mk="count"]').textContent = n.toLocaleString("en-IN");
    const total = M.departures.length;
    let a;
    if (!state.dest && !state.month) a = `departures from ${M.operators.length} operators, leaving between ${dayMonth(idx.first)} and ${dayMonth(idx.last)}. Nothing filtered out.`;
    else {
      const what = (state.dest ? `go to ${destLabel(state.dest)}` : "") + (state.dest && state.month ? " in " : "") + (state.month ? (state.dest ? monthLabel(state.month) : `leave in ${monthLabel(state.month)}`) : "");
      a = n ? `of ${total.toLocaleString("en-IN")} ${what}. They are the ones lit up.` : `None of the ${total.toLocaleString("en-IN")} ${what} in this snapshot. Try another month or place.`;
    }
    $('[data-mk="a"]').textContent = a;
    const pool = n ? sel : M.departures.map((_, i) => i);
    const months = {};
    pool.forEach((i) => { const m = M.departures[i][1].slice(0, 7); months[m] = (months[m] || 0) + 1; });
    const busiest = Object.entries(months).sort((x, y) => y[1] - x[1])[0];
    const prices = pool.map((i) => M.departures[i][2]);
    const range = `Prices run from ${inr(Math.min(...prices))} to ${inr(Math.max(...prices))}.`;
    $('[data-mk="b"]').textContent = !n ? "Nothing matches that search in this snapshot."
      : state.month ? `${n} departure${n === 1 ? "" : "s"} in ${monthLabel(state.month)}. ${range}`
      : `${MONTHS[+busiest[0].slice(5) - 1]} is the busiest month, with ${busiest[1]} departures. ${range}`;
  }

  /* ======================================================== layout */
  const L = { vw: innerWidth, vh: innerHeight, gate: { top: 0, h: 1 }, market: { top: 0, h: 1 } };
  function measure() {
    L.vw = innerWidth; L.vh = innerHeight;
    for (const k of ["gate", "market"]) {
      const el = document.getElementById(k), r = el.getBoundingClientRect();
      L[k] = { top: r.top + scrollY, h: r.height, el };
    }
    Scene.resize(); Sky.layout();
    kick();
  }
  addEventListener("resize", () => { clearTimeout(measure.t); measure.t = setTimeout(measure, 120); });
  addEventListener("load", measure);
  // content that changes height (the board, fonts, the rail) moves every act below it: re-measure both
  let lastMainH = 0;
  new ResizeObserver(() => {
    const h = document.querySelector("main").offsetHeight;
    if (Math.abs(h - lastMainH) < 2) return;
    lastMainH = h;
    clearTimeout(measure.r);
    measure.r = setTimeout(() => { sc.layout && sc.layout(); measure(); }, 60);
  }).observe(document.querySelector("main"));

  /* ======================================================== the scene (WebGL) */
  const IMG = { w: 2400, h: 1600 };
  const isPhone = () => L.vw < 861 || L.vw / L.vh < 0.9;
  function coverRect() {
    const s = Math.max(L.vw / IMG.w, L.vh / IMG.h);
    const w = IMG.w * s, h = IMG.h * s;
    const fy = isPhone() ? 0.5 : 0.72;
    return [(L.vw - w) * 0.5, (L.vh - h) * fy, w, h];
  }
  function dollyCentre(c) { return [c[0] + c[2] * 0.5, c[1] + c[3] * 0.62]; }

  const Scene = (() => {
    const cv = $("#scene"), front = $(".gate__front");
    let gl = null, prog = null, U = {}, ready = false, dpr = 1;
    const cur = { zoom: 0, push: 0, night: 0, expo: 1, mx: 0, my: 0 };
    const tgt = { mx: 0, my: 0 };
    const VS = `#version 300 es
      in vec2 a; out vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
    const FS = `#version 300 es
      precision highp float;
      uniform sampler2D uBack, uAux;
      uniform vec2 uRes; uniform vec4 uCover; uniform vec2 uC;
      uniform float uZoom, uPush, uNight, uExpo; uniform vec2 uM;
      in vec2 v; out vec4 o;
      vec2 toUV(vec2 px){ return (px - uCover.xy) / uCover.zw; }
      void main(){
        vec2 q = vec2(v.x, 1.0 - v.y) * uRes;
        vec2 p = uC + (q - uC) / (1.0 + uZoom);
        for (int i = 0; i < 4; i++) {
          float d = texture(uAux, clamp(toUV(p), 0.0, 1.0)).r;
          float s = 1.0 + uZoom + uPush * d;
          p = uC + (q - uM * (0.3 + d * 1.6) - uC) / s;
        }
        vec2 uv = clamp(toUV(p), 0.0005, 0.9995);
        vec3 c = texture(uBack, uv).rgb;
        vec4 aux = texture(uAux, uv);
        float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // day: a touch less saturated, a touch warmer as the afternoon goes on
        vec3 day = mix(vec3(L), c, 0.9);
        day = mix(day, day * vec3(1.07, 1.0, 0.88), clamp(uNight * 5.0, 0.0, 1.0));
        // night: graded from the same pixels. Sky becomes a deep gradient, land goes moonlit.
        float h = clamp(q.y / uRes.y, 0.0, 1.0);
        vec3 nsky = mix(vec3(0.012, 0.018, 0.04), vec3(0.055, 0.08, 0.13), smoothstep(0.02, 0.7, h));
        vec3 nland = vec3(0.022, 0.03, 0.045) + pow(L, 1.15) * vec3(0.17, 0.205, 0.27);
        vec3 night = mix(nland, nsky, smoothstep(0.35, 0.75, aux.g));
        vec3 col = mix(day, night, smoothstep(0.2, 1.0, uNight));
        // a soft lens falloff
        vec2 cq = q / uRes - 0.5;
        col *= 1.0 - dot(cq, cq) * 0.55 * smoothstep(0.0, 1.0, uNight);
        o = vec4(col * uExpo, 1.0);
      }`;
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function tex(unit, img) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
    function fail(e) { if (e) console.warn("[getpackd] WebGL unavailable, using the still", e); document.documentElement.classList.add("no-gl"); ready = false; }
    async function init() {
      try {
        gl = cv.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
        if (!gl) return fail();
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ["uBack", "uAux", "uRes", "uCover", "uC", "uZoom", "uPush", "uNight", "uExpo", "uM"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
        const [back, aux] = await Promise.all([load("assets/gate-back.jpg"), load("assets/gate-aux.png")]);
        tex(0, back); tex(1, aux);
        gl.uniform1i(U.uBack, 0); gl.uniform1i(U.uAux, 1);
        ready = true; resize(); kick();
      } catch (e) { fail(e); }
    }
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      cv.width = Math.round(L.vw * dpr); cv.height = Math.round(L.vh * dpr);
      const c = coverRect();
      front.style.left = c[0] + "px"; front.style.top = c[1] + "px";
      front.style.width = c[2] + "px"; front.style.height = c[3] + "px";
      if (ready) gl.viewport(0, 0, cv.width, cv.height);
    }
    function pointer(x, y) { tgt.mx = x; tgt.my = y; }
    function frame(view) {
      // view: { zoom, push, night, expo, show }
      Object.assign(cur, view);
      cur.mx += (tgt.mx - cur.mx) * 0.08; cur.my += (tgt.my - cur.my) * 0.08;
      const moving = Math.abs(tgt.mx - cur.mx) + Math.abs(tgt.my - cur.my) > 0.002;
      const c = coverRect(), C = dollyCentre(c);
      // flags + posts: the near plane. Same mapping as the shader at depth 0.9.
      const dF = 0.9, s = 1 + cur.zoom + cur.push * dF * 1.45, lift = -cur.push / 1.6 * L.vh * 0.34;
      const mx = cur.mx * 14, my = cur.my * 9;
      front.style.transformOrigin = `${C[0] - c[0]}px ${C[1] - c[1]}px`;
      front.style.transform = `translate3d(${(mx * (0.3 + dF * 1.6)).toFixed(2)}px,${(my * (0.3 + dF * 1.6) + lift).toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      front.style.opacity = s > 3.4 ? "0" : "1";
      if (!ready || !view.show) return moving;
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform4f(U.uCover, c[0] * dpr, c[1] * dpr, c[2] * dpr, c[3] * dpr);
      gl.uniform2f(U.uC, C[0] * dpr, C[1] * dpr);
      gl.uniform1f(U.uZoom, cur.zoom); gl.uniform1f(U.uPush, cur.push);
      gl.uniform1f(U.uNight, cur.night); gl.uniform1f(U.uExpo, cur.expo);
      gl.uniform2f(U.uM, mx * dpr, my * dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return moving;
    }
    init();
    return { resize, frame, pointer, get ready() { return ready; } };
  })();

  /* ======================================================== the sky of departures */
  const Sky = (() => {
    const cv = $("#sky"), ctx = cv.getContext("2d"), axis = $("[data-axis]"), tip = $("#tip");
    let pts = [], ridge = null, dpr = 1, chart = null, lit = null, anyFilter = false, hover = -1, last = { t: -1 };
    const rnd = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // ridge line from the sky mask, so stars stay in the sky
    const auxImg = new Image(); auxImg.src = "assets/gate-aux.png";
    auxImg.onload = () => {
      const c = document.createElement("canvas"); c.width = auxImg.width; c.height = auxImg.height;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(auxImg, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height).data;
      ridge = new Float32Array(c.width);
      for (let i = 0; i < c.width; i++) {
        let r = 0;
        for (let j = 0; j < c.height * 0.8; j++) if (px[(j * c.width + i) * 4 + 1] > 128) r = j;
        ridge[i] = r / c.height;
      }
      layout(); kick();
    };
    function ridgeScreen(xs, S) {
      // night pose: far plane scaled by S about the dolly centre
      const c = coverRect(), C = dollyCentre(c);
      const xi = C[0] + (xs - C[0]) / S;
      const u = clamp((xi - c[0]) / c[2], 0, 0.999);
      const ry = ridge ? ridge[Math.floor(u * ridge.length)] : 0.5;
      return C[1] + (c[1] + ry * c[3] - C[1]) * S;
    }
    function build() {
      if (!M) return;
      const r = rnd(1273);
      pts = M.departures.map((d, i) => ({
        i, u: r(), v: r(), size: 0.7 + Math.pow(r(), 2.4) * 1.9, ph: r() * 6.283, fq: 0.6 + r() * 1.4, appear: r(), jx: r() - 0.5, jy: r() - 0.5,
        sx: 0, sy: 0, cx: 0, cy: 0, x: 0, y: 0,
      }));
      layout(); paint();
    }
    function layout() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(L.vw * dpr); cv.height = Math.round(L.vh * dpr);
      if (!M || !pts.length) return;
      const phone = isPhone();
      const S = 1 + NIGHT.zoom;
      const top = L.vh * (phone ? 0.12 : 0.1);
      const x0 = phone ? L.vw * 0.17 : Math.max(L.vw * 0.09, 96), x1 = L.vw - (phone ? L.vw * 0.05 : Math.max(L.vw * 0.05, 48));
      // the chart starts below the copy that introduces it, whatever height that copy wraps to
      const cb = $(".market__copy--b");
      const y0 = Math.max(L.vh * (phone ? 0.44 : 0.43), cb ? cb.offsetTop + cb.offsetHeight + 30 : 0);
      const y1 = Math.max(y0 + 140, L.vh * (phone ? 0.8 : 0.84));
      const d0 = date(idx.months[0] + "-01").getTime();
      const lm = idx.months[idx.months.length - 1].split("-").map(Number);
      const d1 = new Date(lm[0], lm[1], 1).getTime();
      const P0 = Math.log(600), P1 = Math.log(500000);
      chart = { x0, x1, y0, y1, d0, d1, P0, P1 };
      pts.forEach((p) => {
        const d = M.departures[p.i];
        p.sx = L.vw * (0.02 + p.u * 0.96);
        const ry = ridgeScreen(p.sx, S) - 16;
        p.sy = top + Math.max(0, ry - top) * Math.pow(p.v, 1.35);
        const t = date(d[1]).getTime();
        p.cx = x0 + ((t - d0) / (d1 - d0)) * (x1 - x0) + p.jx * 3.2;
        p.cy = y1 - ((Math.log(d[2]) - P0) / (P1 - P0)) * (y1 - y0) + p.jy * 3.2;
        p.xn = (p.cx - x0) / (x1 - x0);
      });
      // axis labels (DOM, real text)
      const ticks = [1000, 5000, 10000, 25000, 50000, 100000, 200000, 400000];
      const tl = (v) => (v >= 100000 ? "₹" + v / 100000 + "L" : "₹" + v / 1000 + "k");
      const mh = idx.months.map((m) => {
        const [y, mo] = m.split("-").map(Number);
        const a = new Date(y, mo - 1, 1).getTime(), b = new Date(y, mo, 1).getTime();
        const x = x0 + (((a + b) / 2 - d0) / (d1 - d0)) * (x1 - x0);
        const name = phone ? MONTHS[mo - 1].slice(0, 1) : MONTHS[mo - 1].slice(0, 3);
        return `<span class="m" style="left:${x.toFixed(1)}px;top:${(y1 + 14).toFixed(1)}px">${name}<b data-mc="${m}">${idx.byMonth[m].length}</b></span>`;
      }).join("");
      const ph = ticks.map((v) => `<span class="pz" style="left:${x0.toFixed(1)}px;top:${(y1 - ((Math.log(v) - P0) / (P1 - P0)) * (y1 - y0)).toFixed(1)}px">${tl(v)}</span>`).join("");
      axis.innerHTML = mh + ph;
      counts();
      last.t = -1;
    }
    function paint() {
      if (!M) return;
      anyFilter = !!(state.dest || state.month);
      lit = new Uint8Array(M.departures.length);
      for (let i = 0; i < M.departures.length; i++) lit[i] = matches(i) ? 1 : 0;
      counts();
      last.t = -1;
    }
    // month counts under the axis follow the query
    function counts() {
      if (!lit) return;
      $$("[data-mc]", axis).forEach((b) => {
        const m = b.dataset.mc; b.textContent = (idx.byMonth[m] || []).filter((i) => lit[i]).length;
      });
    }
    // draw: tStars (0..1 how many have appeared), tChart (0..1 progress to chart), show (0..1 layer opacity)
    function draw(tStars, tChart, show, time) {
      cv.style.opacity = show.toFixed(3);
      axis.style.opacity = (smooth((tChart - 0.55) / 0.4) * show).toFixed(3);
      if (show <= 0.001 || !pts.length) { tipHide(); return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, L.vw, L.vh);
      const g = chart;
      // gridlines appear with the chart
      const ga = smooth((tChart - 0.5) / 0.45);
      if (ga > 0) {
        ctx.strokeStyle = `rgba(236,238,234,${(0.09 * ga).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath();
        [1000, 5000, 10000, 25000, 50000, 100000, 200000, 400000].forEach((v) => {
          const y = Math.round(g.y1 - ((Math.log(v) - g.P0) / (g.P1 - g.P0)) * (g.y1 - g.y0)) + 0.5;
          ctx.moveTo(g.x0, y); ctx.lineTo(g.x1, y);
        });
        idx.months.forEach((m) => {
          const x = Math.round(g.x0 + ((date(m + "-01").getTime() - g.d0) / (g.d1 - g.d0)) * (g.x1 - g.x0)) + 0.5;
          ctx.moveTo(x, g.y0 - 8); ctx.lineTo(x, g.y1 + 6);
        });
        ctx.stroke();
      }
      const warm = "241,233,220", acc = "255,107,74";
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        const on = smooth((tStars - p.appear * 0.85) / 0.15);
        if (on <= 0) { p.x = -99; continue; }
        const ti = reduce ? (tChart > 0.5 ? 1 : 0) : ease((tChart * 1.4 - p.xn * 0.4));
        p.x = lerp(p.sx, p.cx, ti); p.y = lerp(p.sy, p.cy, ti);
        const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(time * p.fq + p.ph) * (1 - ti);
        const isLit = lit[p.i];
        let a = on * tw * (anyFilter ? (isLit ? 1 : 0.16) : 0.95);
        let rad = lerp(p.size, 1.9, ti) * (anyFilter && isLit ? 1.45 : 1);
        if (k === hover) { a = 1; rad += 2; }
        ctx.fillStyle = `rgba(${anyFilter && isLit ? acc : warm},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.2832); ctx.fill();
        if (p.size > 1.7 && ti < 0.6) {
          // the brighter stars get a soft bloom, fading as they settle into the chart
          ctx.fillStyle = `rgba(${anyFilter && isLit ? acc : warm},${(a * 0.13 * (1 - ti / 0.6)).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad * 3.2, 0, 6.2832); ctx.fill();
        }
      }
    }
    function nearest(x, y, r) {
      let best = -1, bd = r * r;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k]; if (p.x < -50) continue;
        if (anyFilter && !lit[p.i]) continue;
        const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = k; }
      }
      return best;
    }
    function tipShow(k) {
      const p = pts[k], d = M.departures[p.i], t = M.trips[d[0]];
      tip.innerHTML = `<b>${esc(t[0])}</b><span>${esc(M.operators[t[1]])}</span><span>${shortDate(d[1])} · ${t[3]} days · ${esc(idx.destName[t[2]])}</span><strong>${inr(d[2])}</strong>`;
      const w = tip.offsetWidth || 220, h = tip.offsetHeight || 90;
      let x = p.x + 14, y = p.y - h - 12;
      if (x + w > L.vw - 12) x = p.x - w - 14;
      if (y < 80) y = p.y + 14;
      tip.style.transform = `translate3d(${x.toFixed(0)}px,${y.toFixed(0)}px,0)`;
      tip.style.opacity = "1";
    }
    function tipHide() { if (hover !== -1) { hover = -1; } tip.style.opacity = "0"; }
    function probe(x, y, touch) {
      if (!active()) return tipHide();
      const k = nearest(x, y, touch ? 22 : 12);
      if (k === -1) return tipHide();
      hover = k; tipShow(k); kick();
    }
    let isActive = false;
    const active = () => isActive;
    return { build, layout, paint, draw, probe, tipHide, setActive(v) { isActive = v; if (!v) tipHide(); } };
  })();

  /* ======================================================== the frame loop */
  const NIGHT = { zoom: 0.32, push: 1.6 };
  let raf = 0, t0 = performance.now(), lastSig = "", lastCount = -1, selCount = 0;
  const countEl = $('[data-mk="count"]');
  const gateScrim = $(".gate__scrim");
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  addEventListener("scroll", kick, { passive: true });
  if (fine && !reduce) {
    addEventListener("pointermove", (e) => {
      Scene.pointer((e.clientX / L.vw - 0.5) * 2, (e.clientY / L.vh - 0.5) * 2);
      kick();
    }, { passive: true });
  }
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") Sky.probe(e.clientX, e.clientY, false); }, { passive: true });
  addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") Sky.probe(e.clientX, e.clientY, true); }, { passive: true });

  function loop(now) {
    raf = 0;
    const y = scrollY, vh = L.vh;
    const G = L.gate, K = L.market;
    let view = { zoom: 0, push: 0, night: 0, expo: 1, show: false };
    let tStars = 0, tChart = 0, skyShow = 0, night = false;
    if (y < G.top + G.h) {
      const p = clamp((y - G.top) / Math.max(G.h - vh, 1));
      const e = reduce ? 0 : smooth(p);
      view = { zoom: 0.32 * e, push: 1.6 * e, night: 0.16 * e, expo: 1, show: true };
      // the text scrim leaves with the last line of copy, so it never rides up over the sky
      gateScrim.style.opacity = (1 - smooth((p - 0.9) / 0.08)).toFixed(3);
    } else if (y + vh > K.top && y < K.top + K.h) {
      night = true;
      const entry = clamp((y + vh - K.top) / vh);
      const p = clamp((y - K.top) / Math.max(K.h - vh, 1));
      tStars = reduce ? 1 : smooth(entry * 0.25 + p * 4);
      tChart = reduce ? (p > 0.4 ? 1 : 0) : smooth((p - 0.42) / 0.32);
      const dim = 1 - 0.58 * tChart;
      view = { zoom: NIGHT.zoom, push: NIGHT.push, night: 1, expo: Math.pow(entry, 1.6) * dim, show: true };
      skyShow = Math.pow(entry, 2);
      }
    if (night && M) {
      const n = Math.round(selCount * clamp(tStars * 1.04));
      if (n !== lastCount) { lastCount = n; countEl.textContent = n.toLocaleString("en-IN"); }
    }
    document.documentElement.classList.toggle("is-night", night);
    document.documentElement.classList.toggle("is-past", y > G.top + G.h - L.vh * 0.6);
    $("#scene").style.visibility = view.show ? "visible" : "hidden";
    Sky.setActive(night && skyShow > 0.6);
    const moving = Scene.frame(view);
    const time = (now - t0) / 1000;
    Sky.draw(tStars, tChart, skyShow, time);
    // tell the verification harness what actually painted on the fixed layers
    const sig = `${view.zoom.toFixed(3)}|${view.expo.toFixed(2)}|${tStars.toFixed(2)}|${tChart.toFixed(2)}`;
    if (sig !== lastSig) {
      lastSig = sig;
      G.el && G.el.querySelector("[data-sc-stage]").setAttribute("data-sc-verify-state", view.night < 0.5 ? sig : "");
      K.el && K.el.querySelector("[data-sc-stage]").setAttribute("data-sc-verify-state", night ? sig : "");
    }
    // keep animating while the pointer eases or stars twinkle on screen
    if (moving || (skyShow > 0 && !reduce)) kick();
  }
  measure();
  kick();
})();

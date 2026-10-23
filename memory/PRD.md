# getPackd — PRD

## Original problem statement
"Skyscanner for group trips": every group departure from Indian operators (global destinations) in one place, Skyscanner-style search + results (no wizard), powerful facets with live counts, like-for-like TRUE price, who else is going (age/gender/solo mix), verified operators, departures + day-by-day itineraries. Lead-gen only (Enquire / Go to operator), no payments. Meeting point at destination (no start city). Full spec in conversation (home, results, compare, trip detail, operator profile, category/SEO pages, alerts, shortlist voting, operator listing page, admin).

## User choices
- NL search: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) via Emergent LLM key
- Alerts: saved to DB only (no emails sent yet)
- Admin: admin / wayfind2026 (backend .env)
- Hero globe: lightweight d3-geo canvas (no three.js)

## Architecture
- Backend FastAPI + MongoDB. `seed_data.py` (deterministic generator: 22 destinations, 36 fictional operators across 6 categories, ~100 trips, ~357 departures Oct 2026–Jan 2027, group stats, reviews; reseeds when SEED_VERSION changes). `search_engine.py` builds in-memory joined index (reloaded on admin writes): filters, disjunctive facet counts, true-price normalisation (8-item checklist + reference table), fit score (personas + 6-question quiz), Best ranking (fit × trust × freshness × reviews × price), clusters by trip, price strip (weeks/months), map, calendar, relaxations.
- Frontend React + Tailwind + Framer Motion + d3-geo/topojson (world-atlas CDN) + canvas-confetti. URL-driven filter state. LocalStorage for hearts, compare tray, currency, dark mode, quiz.

## Implemented (Jun 2026)
- Home: animated globe w/ route arcs + plane, parallax mountains/clouds, word-by-word headline, glass search bar (Where autocomplete / When range + flex / Travelling as / Budget / AI NL search), explore grid + map, trending, vibe tiles with hover animations, why true price, how it works
- Results: sticky editable search (compact on mobile), ticking counter, Best/Cheapest/Soonest + Shortest/Rated/Verified tabs w/ headline values, price-by-date strip, List/Map/Calendar views, full filter rail with live counts (bottom sheet on mobile, "Show N trips"), removable chips, clear all, save search, fit quiz + Fit ring, ticket-stub cards (true price popover, seats bar, status pill, age/gender bars, fit chip, heart burst, compare), clusters, smart empty states with relaxation counts
- Compare page (up to 4), trip detail (scroll-drawn itinerary, meeting point, inclusions, donut, leader, safety, reviews, departures picker, lead form + confetti, cancelled state), operator profile, 5 category pages, alerts page, shortlist + shareable voting link, operator signup page, admin (leads, verify operators, add operator/trip/departure, signups), dark mode, ₹/$ toggle, plane-sweep route transition, reduced-motion support
- Testing: iteration_1 — backend 29/29, frontend all critical flows pass

## Backlog
- P1: Real email delivery for alerts (Resend) + price-drop detection job
- P1: Operator self-serve dashboard (manage own departures, see leads)
- P2: Image upload for operators (object storage), richer admin trip editor (itinerary editing)
- P2: SEO SSR/prerender for category pages, sitemap
- P2: Paid placement (always labelled) if ever added

## Update (Oct 2026)
- Backend ported from FastAPI/Python to Node.js + TypeScript (Express). NL search now uses the Anthropic SDK (`ANTHROPIC_API_KEY`).
- Sample data replaced by real operators (`backend/data/operators.json`, 39 with websites) and trips imported from operators' own sites (`yarn import:trips` → `backend/data/trips.json`). No ratings, reviews, group stats or verification are shown for these operators; "true price" only adds 5% GST when the operator lists it as extra.
- Homepage redesigned (photo hero, dark theme below the hero).

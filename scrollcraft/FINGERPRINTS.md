# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| getpackd-anywhere (2026-11-05) | **Search instrument** (new): the page is one running query; each section widens its scope (one place, one valley, the whole market, the operators, the provenance, your query). Bans invented numbers, testimonials, scrub, spotlight, magnet, per-section CTAs; every section shows live data | The query is the nav: wordmark + a pill of two native selects (Where/When), a live count and the one CTA; editing it re-points every section | Pinned depth dolly through a real photo split into planes with a depth model: WebGL depth-warped clean plate (sky, ridge, lake, sand) + DOM alpha cutout of prayer flags and posts that lifts overhead; copy between the planes | 7 acts, 12.8vh desktop: pin(depth) 1.9 · flow+FLIP sort · kinetic silence 1.1 · **pin peak 3.6** (night + star canvas → chart) · pan 3.0 · reveal · flow close | A sentence-form query ("Show me departures to [Anywhere] in [any month].") with the live count and one button that deep-links the query into the app; footer inside it | The same photograph returns at night and every departure is a star over the ridge; the stars then settle into the whole market by month and price, and the Where/When field lights only matching stars (hover/tap reads the real departure) | Photographic, low-key: Pangong Tso daylight to day-for-night grade, brand coral on off-black | :4500 |

| getpackd-anywhere r2 (2026-11-05, after user review) | Search instrument (as r1) | Wordmark + compact centred query that appears only after the hero; the hero itself holds the full four-field search | Cycling places: six photos, each depth-warped from its own depth map, crossfading, caption = that place's live count; centred headline + search | 5 acts, 7.2vh: flow hero · flow+FLIP sort (peak) · pan 3.0 · reveal · flow close | Same sentence-form query close as r1 | The query re-points the page; picking a hero place in Where shows and holds that place (stars/chart removed at the user's request) | Photographic, daylight, six Indian places, brand coral on off-black | :4500 |

*(r1 was the first build in this registry. r2 shares grammar and close with r1 by design: it is a revision, not a new build.)*

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- **Search instrument** grammar (query-as-nav, scope ladder, close = the visitor's own query with count).
- **Depth-model plane split** of a single photo (WebGL depth-warped plate + alpha cutout) as the hero device.
- **Same photo returns graded to night** as the peak's ground.
- **Data points as stars that settle into a chart**, filtered by the nav query.
- Sentence-form native-select close.
- Band: 7 acts at ~12.8vh with one 3.6vh peak pin.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.

# getPackd · Anywhere — BRIEF

**Self-authored under explicit creative delegation.** On 2026-11-04 the user chose
"Use your judgment" when asked whether to match a reference or let me design.
Their own words and picks are quoted verbatim below; everything marked
*Authored* is my decision under that delegation.

## What the user actually said

> "redo and design a premium and trusted website for my current idea which is
> skyscanner but for group travel in India(like just wravel) Every group
> departure from every operator, side by side. Leave it on Anywhere to see the
> whole market."

Picks from the interview (2026-11-04):

| Question | Answer |
|---|---|
| Reference or delegate | **Use your judgment** |
| Look | **Premium-minimal** |
| The one moment | **The whole market on Anywhere** |
| Placement | **Standalone page first** (live site untouched) |

Evidence from an earlier session the same day (from my notes, paraphrased, not
a quotation): the current UI felt "everywhere"; a first-time visitor would not
understand what the site does; they want a modern look, light three.js, nothing
AI-looking, good transitions and a clear flow. Three designs I picked on my own
were rejected (magazine, print-room, 3D flap board), so no split-flap boards,
no paper/editorial costume.

## The eight topics

1. **Vibe** *(Authored)*: calm, exact, Himalayan, trustworthy. References: the
   hush of a mountain lake at dusk; an airline's departures timetable read as a
   document, not a gadget; a night sky over Ladakh.
2. **Scroll journey** *(Authored from the user's sentence)*: see one place →
   see one trip from every operator side by side → leave it on Anywhere → the
   whole market → who is in it → why the numbers can be trusted → your search.
3. **Energy** *(Authored)*: calm open, crisp middle, one silence, a loud peak,
   then quiet and certain to the end.
4. **Feeling and the one moment**: user picked *the whole market on Anywhere*.
   Curve below.
5. **What no other site does** *(Authored, seeded by "Leave it on Anywhere")*:
   the one Where field in the bar re-points the entire page. Leave it on
   Anywhere and you see every departure; pick a place and every section answers
   for that place.
6. **Range**: premium-minimal (user's pick). Dark, quiet, one accent, air.
7. **One world or scenes** *(Authored)*: distinct scenes. One photograph returns
   twice (day at the top, night at the peak) as a callback, not a continuous
   flight.
8. **Assets**: none supplied. No KIE key and no ffmpeg in this environment, so
   nothing is generated and there is no scrub video. Built from the repo's own
   Unsplash destination photo of Pangong Tso (photo-1593118845043), split into
   planes with a depth model, and from the real snapshot in
   `backend/data/trips.json` (fetched 2026-11-04).

## Facts the page may state (verified in the repo)

- Snapshot 2026-11-04: **1,273** upcoming departures, **391** trips,
  **34** operators with live departures, **48** destinations.
- No payment happens on getPackd; you book with the operator
  (TripDetail.jsx booking panel copy).
- Prices are read from the operator's own site; the only amount ever added is
  5% GST when the operator says GST is extra (searchEngine.ts `statedPrice`).
- Spiti Valley: 15 trips, 8 operators, 74 departures. On Sat 7 Nov 2026 four
  operators leave: Treks and Trails ₹15,999 (8 days), Tripper Trails ₹18,899,
  Himtrek ₹19,949, JustWravel ₹23,625 (9 days each). Computed live in the page.

Not claimed anywhere: reviews, ratings, "verified", ranking neutrality, user
counts, savings percentages.

## Journey (beats)

1. Arrival: a real place, and the promise in one line.
2. Clarity: one valley, one Saturday, every operator in a row.
3. Anticipation: the instruction. Leave it on Anywhere.
4. Awe (peak): every departure in the market at once.
5. Breadth: the 34 names behind it.
6. Confidence: where the numbers come from.
7. Resolve: your search, its count, one button.

## Feeling curve

| Act | Feeling | What on screen causes it |
|---|---|---|
| 1 Gate | calm wonder | Pangong in daylight through prayer flags; scrolling walks you through the flag gate, planes separating |
| 2 Side by side | clarity | one Saturday's Spiti departures land in a row and sort themselves by price; the gap between cheapest and dearest is named |
| 3 Silence | anticipation | near-black, one line: "Now leave it on Anywhere." Nothing else (authored silence) |
| 4 The market | awe | night falls over the same lake; 1,273 departures appear as stars, then settle into the whole market by month and price |
| 5 Operators | breadth | 34 operator names travel sideways with their own counts |
| 6 Honest numbers | confidence | three plain statements, each with its proof |
| 7 Your search | resolve | the Where field, grown large, with the count for the visitor's own query and one button |

## The peak

> "You leave it on Anywhere and night falls over Pangong, and every star is a
> real group trip, twelve hundred and something of them, and then they line up
> by month so you can see the whole market at once."

Lives in act 4. It gets the largest span on the page, the only return of the
photograph, and the silence of act 3 in front of it.

## Tell-someone sentence

It's the site where **every star over Pangong turns out to be a group trip you
can actually book, and picking a place in one box makes the rest go dark**.

## Feel check (after the build)

Not fully cold: I had watched every frame while fixing it. One word per act,
then the diff against the curve above.

| Act | Intended | Felt | Change made |
|---|---|---|---|
| 1 Gate | calm wonder | calm, then "walking in" | Flags first stayed on screen at the end of the push, so they now lift overhead and leave by p≈0.75 |
| 2 Side by side | clarity | clarity | Price column was clipping its hairline; widened |
| 3 Silence | anticipation | anticipation | none |
| 4 Market | awe | awe, then understanding | Stars were too faint (read as dust), now a richer field with bloom on the brightest; chart dims the scene further |
| 5 Operators | breadth | thoroughness (reads a bit like a directory) | Phone rail was a blur (2.4px sideways per px); now 3 rows and a longer span |
| 6 Honest numbers | confidence | reassured, quiet | none |
| 7 Your search | resolve | ready | Sentence selects collapsed to "A."; now sized to the chosen option |

The peak holds the most scroll (3.6vh against 1.9 for the next longest pin)
and is the largest visual change on the sheet. The act before it is the
quietest on the page. The last screen holds the query, the count and the button.

## Authored silence

Act 3 is deliberately almost empty: one line on near-black for about one
viewport. It is not dead scroll.

## One action, one label

**Show departures** — used in the bar and at the close. Deep-links to the app's
`/search?q=…` with the visitor's Where/When carried over.

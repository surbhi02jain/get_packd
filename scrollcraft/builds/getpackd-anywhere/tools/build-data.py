#!/usr/bin/env python3
"""Builds data/market.json from the repo's real trip snapshot (backend/data/trips.json).
Every number the page shows is computed from this file. Run from the repo root."""
import json, re, sys, os
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/market.json"
d = json.load(open(os.path.join(ROOT, "backend/data/trips.json")))
ops = {o["id"]: o for o in json.load(open(os.path.join(ROOT, "backend/data/operators.json")))}
src = open(os.path.join(ROOT, "backend/src/destinations.ts")).read()
names = dict(re.findall(r'slug: "([a-z]+)", name: "([^"]+)"', src))
snap = d["fetched_at"][:10]
trips, deps, op_ids, dest_ids = [], [], [], []
gst_extra = 0
def idx(lst, v):
    if v not in lst: lst.append(v)
    return lst.index(v)
for t in d["trips"]:
    up = [x for x in t["departures"] if x["start"] >= snap and x.get("price")]
    if not up: continue
    ti = len(trips)
    gst_extra_t = t.get("gst_included") is False
    gst_extra += 1 if gst_extra_t else 0
    trips.append([t["title"].strip(), idx(op_ids, t["operator_id"]), idx(dest_ids, t["destination_slug"]), t["duration_days"], t["url"]])
    for x in up:
        p = x["price"] + (round(x["price"] * 0.05) if gst_extra_t else 0)
        deps.append([ti, x["start"], p, x.get("seats_left")])
deps.sort(key=lambda r: (r[1], r[2]))
out = {
  "snapshot": snap,
  "operators": [ops[o]["name"] if o in ops else o for o in op_ids],
  "destinations": [[s, names.get(s, s.title())] for s in dest_ids],
  "trips": trips,
  "departures": deps,
  "gst_extra_trips": gst_extra,
}
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{OUT}: {len(deps)} departures, {len(trips)} trips, {len(op_ids)} operators, {len(dest_ids)} destinations, snapshot {snap}")

// Comprehensive backend API tests for getPackd. They run against a live backend.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

const BASE = (process.env.REACT_APP_BACKEND_URL ?? "https://true-price-travels.preview.emergentagent.com").replace(/\/+$/, "");
const API = `${BASE}/api`;

interface CallOptions {
  params?: Record<string, string>;
  json?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

async function call(method: string, path: string, { params, json, headers, timeout }: CallOptions = {}): Promise<{ status: number; data: any; text: string }> {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  const r = await fetch(`${API}${path}${qs}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: json === undefined ? undefined : JSON.stringify(json),
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  });
  const text = await r.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON body
  }
  return { status: r.status, data, text };
}

const get = (path: string, opts?: CallOptions) => call("GET", path, opts);
const post = (path: string, opts?: CallOptions) => call("POST", path, opts);

let adminToken: string;
before(async () => {
  const r = await post("/admin/login", { json: { username: "admin", password: "wayfind2026" } });
  assert.equal(r.status, 200, r.text);
  adminToken = r.data.token;
});

// ---------- health / meta ----------
describe("Health", () => {
  it("root", async () => {
    const r = await get("/");
    assert.equal(r.status, 200);
    assert.ok(r.data.departures > 0);
    assert.ok(r.data.prices_fetched_at);
  });

  it("meta", async () => {
    const r = await get("/meta");
    assert.equal(r.status, 200);
    assert.ok(r.data.destinations.length >= 20);
    assert.ok(r.data.operators.length >= 30);
    assert.ok(r.data.operators.every((o: { verified_status: string }) => o.verified_status !== "verified" || !("source" in o)));
    assert.ok(r.data.price_bounds.min > 0);
  });

  it("home", async () => {
    const r = await get("/home");
    assert.equal(r.status, 200);
    assert.ok(r.data.stats.departures > 0);
    assert.ok(r.data.stats.destinations > 0);
    assert.ok(r.data.stats.operators > 0);
    assert.ok(r.data.trending.length >= 1);
    assert.ok("styles" in r.data);
  });
});

// ---------- search ----------
describe("Search", () => {
  it("search returns departures with facets", async () => {
    const all = (await get("/search")).data;
    const r = await get("/search", { params: { as: "solo_woman", max_price: "100000" } });
    assert.equal(r.status, 200);
    assert.ok(r.data.total_departures > 0 && r.data.total_departures <= all.total_departures);
    assert.ok(r.data.clusters.length > 0);
    assert.ok("facets" in r.data && "price_strip" in r.data);
  });

  it("imported trips carry only what the operator publishes", async () => {
    const r = await get("/search", { params: { limit: "300" } });
    for (const c of r.data.clusters) {
      const card = c.lead;
      if (card.source !== "import") continue;
      assert.ok(card.url.startsWith("http"), "links to the operator's page");
      assert.equal(card.rating, null);
      assert.equal(card.gender_split, null);
      assert.equal(card.age_range, null);
      assert.equal(card.op.verified_status, "listed");
      // the only amount ever added to a listed price is 5% GST
      const extras = card.breakdown.filter((l: { amount: number }) => l.amount > 0);
      assert.ok(extras.every((l: { key: string }) => l.key === "taxes"));
      assert.equal(card.true_price, card.price + extras.reduce((n: number, l: { amount: number }) => n + l.amount, 0));
    }
  });

  it("empty search has relaxations", async () => {
    const r = await get("/search", { params: { q: "atlantis" } });
    assert.equal(r.status, 200);
    // expect empty but with relaxations
    assert.equal(r.data.total_departures, 0);
    assert.ok(Array.isArray(r.data.relaxations));
  });

  it("facets women only", async () => {
    const r = await get("/search", { params: { gender: "women_only" } });
    assert.equal(r.status, 200);
    assert.ok(r.data.total_departures > 0);
  });

  it("facets verified", async () => {
    // imported operators are "listed", never "verified", so this filter only returns operators verified in the admin page
    const r = await get("/search", { params: { trust: "verified" } });
    assert.equal(r.status, 200);
    assert.ok(r.data.clusters.every((c: { lead: { op: { verified_status: string } } }) => c.lead.op.verified_status === "verified"));
  });

  it("sort cheapest", async () => {
    const r = await get("/search", { params: { sort: "cheapest" } });
    const prices: number[] = r.data.clusters.slice(0, 6).filter((c: object) => "from_price" in c).map((c: { from_price: number }) => c.from_price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b), `not sorted ${prices}`);
  });
});

// ---------- trip / operator ----------
describe("TripOperator", () => {
  it("trip detail", async () => {
    const home = (await get("/home")).data;
    const tid = home.trending[0].trip_id;
    const r = await get(`/trips/${tid}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.trip.id, tid);
    assert.notEqual(r.data.operator, null);
    assert.ok(r.data.departures.length > 0);
  });

  it("trip detail 404", async () => {
    const r = await get("/trips/nope-xyz-0");
    assert.equal(r.status, 404);
  });

  it("operator detail", async () => {
    const meta = (await get("/meta")).data;
    const oid = meta.operators[0].id;
    const r = await get(`/operators/${oid}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.operator.id, oid);
  });
});

// ---------- compare / departures ----------
describe("Compare", () => {
  it("compare", async () => {
    const home = (await get("/home")).data;
    const depIds: string[] = home.trending.slice(0, 3).map((t: { dep_id: string }) => t.dep_id);
    const r = await get("/compare", { params: { deps: depIds.join(",") } });
    assert.equal(r.status, 200);
    assert.equal(r.data.items.length, 3);
    assert.ok("card" in r.data.items[0] && "trip" in r.data.items[0]);
  });

  it("departures batch", async () => {
    const home = (await get("/home")).data;
    const ids = home.trending.slice(0, 2).map((t: { dep_id: string }) => t.dep_id).join(",");
    const r = await get("/departures", { params: { ids } });
    assert.equal(r.status, 200);
    assert.equal(r.data.items.length, 2);
  });
});

// ---------- leads ----------
describe("Leads", () => {
  it("create lead", async () => {
    const home = (await get("/home")).data;
    const dep = home.trending[0];
    const r = await post("/leads", { json: { dep_id: dep.dep_id, trip_id: dep.trip_id, name: "TEST_User", phone: "9999999999",
                                             email: "test@example.com", party_size: 2, message: "TEST_lead", kind: "enquire" } });
    assert.equal(r.status, 200, r.text);
    assert.ok(r.data.ok);
  });

  it("lead validation", async () => {
    const r = await post("/leads", { json: { dep_id: "x", trip_id: "y", name: "A", phone: "1" } });
    assert.equal(r.status, 422);
  });
});

// ---------- alerts ----------
describe("Alerts", () => {
  const email = "TEST_alerts@example.com";
  let createdId: string;

  it("create alert", async () => {
    const r = await post("/alerts", { json: { email, filters: { gender: "women_only" }, label: "TEST women-only" } });
    assert.equal(r.status, 200);
    assert.ok(r.data.matches_now > 0);
    createdId = r.data.id;
  });

  it("invalid email", async () => {
    const r = await post("/alerts", { json: { email: "notanemail", filters: {} } });
    assert.equal(r.status, 400);
  });

  it("list alerts", async () => {
    const r = await get("/alerts", { params: { email } });
    assert.equal(r.status, 200);
    assert.ok(r.data.items.some((a: { id: string }) => a.id === createdId));
  });

  it("delete alert", async () => {
    let r = await call("DELETE", `/alerts/${createdId}`);
    assert.equal(r.status, 200);
    r = await get("/alerts", { params: { email } });
    assert.ok(!r.data.items.some((a: { id: string }) => a.id === createdId));
  });
});

// ---------- shortlists ----------
describe("Shortlists", () => {
  let sid: string;

  it("create", async () => {
    const home = (await get("/home")).data;
    const deps = home.trending.slice(0, 3).map((t: { dep_id: string }) => t.dep_id);
    const r = await post("/shortlists", { json: { dep_ids: deps, name: "TEST_Shortlist" } });
    assert.equal(r.status, 200);
    sid = r.data.id;
    assert.ok(sid);
  });

  it("get", async () => {
    const r = await get(`/shortlists/${sid}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.items.length, 3);
  });

  it("vote", async () => {
    const home = (await get("/home")).data;
    const dep: string = home.trending[0].dep_id;
    const r = await post(`/shortlists/${sid}/vote`, { json: { dep_id: dep, voter: "TEST_Alice", vote: "up" } });
    assert.equal(r.status, 200);
    const votes = r.data.shortlist.votes;
    const key = dep.replaceAll(".", "_");
    assert.ok(key in votes);
    assert.ok("TEST_Alice" in votes[key]);
  });
});

// ---------- operator signup ----------
describe("OperatorSignup", () => {
  it("signup", async () => {
    const r = await post("/operator-signups", { json: { company: "TEST_Co", contact_name: "X", email: "test@co.com", phone: "9999", category: "community" } });
    assert.equal(r.status, 200);
  });
});

// ---------- NL search ----------
describe("NL", () => {
  it("nl search", async () => {
    const r = await post("/nl-search", { json: { text: "chill 5-day trip in Nov, women-only, under 30k" }, timeout: 30_000 });
    assert.equal(r.status, 200, r.text);
    const p = r.data.params;
    // expect at least some meaningful filters
    assert.ok("gender" in p || "style" in p || "max_price" in p || "pace" in p);
    assert.ok((p.gender ?? "").includes("women_only") || (r.data.summary ?? "").toLowerCase().includes("women"));
  });
});

// ---------- admin ----------
describe("Admin", () => {
  it("login bad", async () => {
    const r = await post("/admin/login", { json: { username: "admin", password: "wrong" } });
    assert.equal(r.status, 401);
  });

  it("overview", async () => {
    const r = await get("/admin/overview", { headers: { "X-Admin-Token": adminToken } });
    assert.equal(r.status, 200);
    assert.ok("operators" in r.data && "leads" in r.data && "signups" in r.data);
    assert.ok(r.data.counts.departures > 0);
  });

  it("refresh needs admin and reports its schedule", async () => {
    assert.equal((await post("/admin/refresh", { json: {} })).status, 401);
    const r = await get("/admin/overview", { headers: { "X-Admin-Token": adminToken } });
    assert.ok(r.data.refresh.prices_fetched_at);
    assert.ok(r.data.refresh.every_days === 0 || r.data.refresh.next_at || r.data.refresh.running);
  });

  it("overview unauth", async () => {
    const r = await get("/admin/overview");
    assert.equal(r.status, 401);
  });

  it("add operator and verify", async () => {
    const headers = { "X-Admin-Token": adminToken };
    const name = `TEST Operator ${Date.now()}`;
    const r = await post("/admin/operators", { headers, json: { name, category: "women-led", leader_name: "Test Leader" } });
    assert.equal(r.status, 200, r.text);
    const oid = r.data.id;
    const r2 = await call("PATCH", `/admin/operators/${oid}`, { headers, json: { status: "verified" } });
    assert.equal(r2.status, 200);
    // verify persisted
    const d = (await get(`/operators/${oid}`)).data;
    assert.equal(d.operator.verified_status, "verified");
  });

  it("add trip and departure", async () => {
    const headers = { "X-Admin-Token": adminToken };
    const name = `TEST Op T ${Date.now()}`;
    let r = await post("/admin/operators", { headers, json: { name, category: "boutique", leader_name: "L" } });
    const oid = r.data.id;
    const meta = (await get("/meta")).data;
    const dest = meta.destinations[0].slug;
    r = await post("/admin/trips", { headers, json: { operator_id: oid, title: "TEST_Trip Awesome", destination_slug: dest,
                                                      duration_days: 5, categories: ["hiking"], audience_tags: ["solo", "friends"],
                                                      gender_policy: "mixed", age_band: "25-35", start_date: "2026-11-10",
                                                      price_inr: 25000, seats_total: 12 } });
    assert.equal(r.status, 200, r.text);
    const tid = r.data.trip_id;
    // add second departure
    const r2 = await post("/admin/departures", { headers, json: { trip_id: tid, start_date: "2026-12-01", price_inr: 26000, seats_total: 12 } });
    assert.equal(r2.status, 200);
    // trip detail lists both departures
    const td = (await get(`/trips/${tid}`)).data;
    assert.equal(td.departures.length, 2);
  });
});

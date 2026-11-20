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
  // the server's own admin login, given to the tests through the environment (never written in the code)
  const r = await post("/admin/login", { json: { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" } });
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

  it("sort priciest", async () => {
    const r = await get("/search", { params: { sort: "priciest" } });
    const prices: number[] = r.data.clusters.slice(0, 6).map((c: { lead: { true_price: number } }) => c.lead.true_price);
    assert.deepEqual(prices, [...prices].sort((a, b) => b - a), `not sorted high to low ${prices}`);
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
// saved searches belong to an account: no one can list or delete them by typing someone's email
describe("Alerts", () => {
  let createdId: string;
  let auth: Record<string, string>;
  let other: Record<string, string>;
  const signup = async (tag: string) => {
    const r = await post("/auth/signup", { json: { name: "TEST alerts", email: `test_alerts_${tag}_${Date.now()}@example.com`, password: "Test@12345" } });
    assert.equal(r.status, 200, r.text);
    return { Authorization: `Bearer ${r.data.token}` };
  };

  it("needs an account", async () => {
    assert.equal((await post("/alerts", { json: { email: "someone@example.com", filters: {} } })).status, 401);
    assert.equal((await get("/alerts", { params: { email: "someone@example.com" } })).status, 401);
    assert.equal((await call("DELETE", "/alerts/anything")).status, 401);
  });

  it("create alert", async () => {
    auth = await signup("a");
    other = await signup("b");
    const r = await post("/alerts", { headers: auth, json: { email: "ignored@example.com", filters: { gender: "women_only" }, label: "TEST women-only" } });
    assert.equal(r.status, 200, r.text);
    assert.ok(r.data.matches_now > 0);
    assert.ok(r.data.email.startsWith("test_alerts_a_"), "the account's email, not the one sent");
    createdId = r.data.id;
  });

  it("list alerts", async () => {
    const r = await get("/alerts", { headers: auth });
    assert.equal(r.status, 200);
    assert.ok(r.data.items.some((a: { id: string }) => a.id === createdId));
    const theirs = await get("/alerts", { headers: other });
    assert.ok(!theirs.data.items.some((a: { id: string }) => a.id === createdId), "another account doesn't see them");
  });

  it("delete alert", async () => {
    assert.equal((await call("DELETE", `/alerts/${createdId}`, { headers: other })).status, 404, "another account can't delete them");
    let r = await call("DELETE", `/alerts/${createdId}`, { headers: auth });
    assert.equal(r.status, 200);
    r = await get("/alerts", { headers: auth });
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

  it("vote names are kept as typed", async () => {
    const home = (await get("/home")).data;
    const dep: string = home.trending[1].dep_id;
    for (const voter of ["राहुल", "प्रिया", "Priya S", "Priya S."]) {
      const r = await post(`/shortlists/${sid}/vote`, { json: { dep_id: dep, voter, vote: "up" } });
      assert.equal(r.status, 200, r.text);
    }
    const names = Object.keys((await get(`/shortlists/${sid}`)).data.shortlist.votes[dep.replaceAll(".", "_")]);
    assert.equal(names.length, 4, `four different voters, got ${names.join(", ")}`);
    assert.ok(names.includes("राहुल") && names.includes("प्रिया") && !names.includes("anon"));
    assert.equal((await post(`/shortlists/${sid}/vote`, { json: { dep_id: dep, voter: "  ", vote: "up" } })).status, 422);
  });
});

// ---------- operator signup ----------
describe("OperatorSignup", () => {
  it("signup", async () => {
    const r = await post("/operator-signups", { json: { company: "TEST_Co", contact_name: "Xavier", email: "test@co.com", phone: "9999999999", category: "community" } });
    assert.equal(r.status, 200, r.text);
  });

  it("turns away blanks and junk", async () => {
    const ok = { company: "TEST_Co", contact_name: "Xavier", email: "test@co.com", phone: "9999999999", category: "community" };
    for (const bad of [{ company: "   " }, { contact_name: " " }, { email: "not-an-email" }, { phone: "abc" }, { departures_per_year: -5 }, { company: "x".repeat(5000) }, { message: "y".repeat(10000) }]) {
      const r = await post("/operator-signups", { json: { ...ok, ...bad } });
      assert.equal(r.status, 422, `${JSON.stringify(bad).slice(0, 60)} → ${r.status}`);
    }
  });
});

// ---------- search: what people type ----------
describe("Search words and dates", () => {
  it("a picked range means trips that fit inside it", async () => {
    const r = (await get("/search", { params: { start: "2026-12-24", end: "2026-12-28", flex: "0", limit: "300" } })).data;
    for (const c of r.clusters) for (const d of c.departures) {
      assert.ok(d.start >= "2026-12-24" && d.end <= "2026-12-28", `${c.lead.title} ${d.start}–${d.end}`);
    }
  });

  it("a place named outright is that place", async () => {
    const r = (await get("/search", { params: { q: "Bali", limit: "300" } })).data;
    assert.ok(r.total_departures > 0);
    assert.ok(r.clusters.every((c: { lead: { dest_slug: string } }) => c.lead.dest_slug === "bali"), "no Bali Pass trek in Uttarakhand");
  });

  it("a misspelt place is corrected", async () => {
    const right = (await get("/search", { params: { q: "kedarkantha" } })).data;
    const typo = (await get("/search", { params: { q: "kedarkanta" } })).data;
    assert.ok(right.total_departures > 0);
    assert.equal(typo.total_departures, right.total_departures);
    assert.equal(typo.corrected_q, "kedarkantha");
  });

  it("a place with trips, but none on the dates, isn't swapped for another", async () => {
    const r = (await get("/search", { params: { q: "Kasol", start: "2026-12-03", end: "2026-12-06", flex: "0" } })).data;
    assert.ok(!r.interpreted && !r.corrected_q);
  });

  it("a sentence is read as filters", async () => {
    const r = (await get("/search", { params: { q: "beach trip for New Year" } })).data;
    assert.ok(r.total_departures > 0);
    assert.equal(r.interpreted.params.style, "beaches");
    assert.ok(r.interpreted.params.start.endsWith("-12-28"));
  });
});

// ---------- analytics ----------
describe("Analytics", () => {
  const browser = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" };
  const send = (body: unknown, headers: Record<string, string> = browser) =>
    call("POST", "/events", { headers: { ...headers, "Content-Type": "text/plain" }, json: body });

  it("takes events as plain text, as sendBeacon sends them", async () => {
    const home = (await get("/home")).data;
    const c = home.trending[0];
    assert.equal((await send({ type: "page_view", path: `/trip/${c.trip_id}` })).status, 204);
    assert.equal((await send({ type: "book_click", path: `/trip/${c.trip_id}`, props: { op: c.op.id, trip: c.trip_id, dep: c.dep_id } })).status, 204);
    assert.equal((await send({ type: "search", path: "/search", props: { q: "TEST_nowhere", results: 0 } })).status, 204);
  });

  it("turns away junk and ignores bots", async () => {
    assert.equal((await send({ type: "made_up" })).status, 422);
    assert.equal((await send({ type: "page_view", props: { x: "y".repeat(1000) } })).status, 422);
    assert.equal((await send({ type: "page_view", path: "/" }, { "User-Agent": "Googlebot/2.1" })).status, 204);
  });

  it("reports them to the admin only", async () => {
    assert.equal((await get("/admin/analytics")).status, 401);
    const r = await get("/admin/analytics", { params: { days: "7" }, headers: { "x-admin-token": adminToken } });
    assert.equal(r.status, 200, r.text);
    assert.ok(r.data.totals.book_clicks >= 1 && r.data.totals.visitors >= 1);
    assert.ok(r.data.by_operator.length >= 1 && r.data.by_operator[0].name);
    assert.ok(r.data.empty_searches.some((x: { q: string }) => x.q === "test_nowhere"));
    assert.ok(r.data.daily.length >= 1);
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
    // dates relative to today, so the test doesn't go stale
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    r = await post("/admin/trips", { headers, json: { operator_id: oid, title: "TEST_Trip Awesome", destination_slug: dest,
                                                      duration_days: 5, categories: ["hiking"], audience_tags: ["solo", "friends"],
                                                      gender_policy: "mixed", age_band: "25-35", start_date: day(30),
                                                      price_inr: 25000, seats_total: 12 } });
    assert.equal(r.status, 200, r.text);
    const tid = r.data.trip_id;
    // add a second departure, and one that has already left
    const r2 = await post("/admin/departures", { headers, json: { trip_id: tid, start_date: day(50), price_inr: 26000, seats_total: 12 } });
    assert.equal(r2.status, 200);
    const r3 = await post("/admin/departures", { headers, json: { trip_id: tid, start_date: day(-5), price_inr: 20000, seats_total: 12 } });
    assert.equal(r3.status, 200);
    // trip detail and search list only the two upcoming departures
    const td = (await get(`/trips/${tid}`)).data;
    assert.equal(td.departures.length, 2);
    const s = (await get(`/search?q=${encodeURIComponent("TEST_Trip Awesome")}`)).data;
    const c = s.clusters.find((x: { trip_id: string }) => x.trip_id === tid);
    assert.equal(c?.departures.length, 2);
    assert.ok(c.departures.every((d: { start: string }) => d.start >= day(0)));
  });
});

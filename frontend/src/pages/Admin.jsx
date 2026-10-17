import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { useMeta } from "@/components/SearchBar";
import { http } from "@/lib/api";
import { LABELS, STYLES } from "@/lib/constants";

const inp = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral";

function Login({ onToken }) {
  const [u, setU] = useState(""), [p, setP] = useState("");
  const go = async (e) => {
    e.preventDefault();
    try { const { data } = await http.post("/admin/login", { username: u, password: p }); sessionStorage.setItem("wf_admin", data.token); onToken(data.token); }
    catch { toast.error("Invalid credentials"); }
  };
  return (
    <form onSubmit={go} className="mx-auto mt-20 max-w-sm space-y-3 rounded-[28px] bg-card p-8 shadow-lift" data-testid="admin-login-form">
      <p className="font-display text-3xl">Admin</p>
      <input data-testid="admin-username" className={inp} placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} />
      <input data-testid="admin-password" type="password" className={inp} placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />
      <button data-testid="admin-login-submit" className="w-full rounded-xl bg-coral py-2.5 font-semibold text-white">Sign in</button>
    </form>
  );
}

function Form({ fields, onSubmit, testId, submit }) {
  const [f, setF] = useState(Object.fromEntries(fields.map((x) => [x[0], x[3] ?? ""])));
  return (
    <form data-testid={testId} onSubmit={async (e) => { e.preventDefault(); if (await onSubmit(f)) setF(Object.fromEntries(fields.map((x) => [x[0], x[3] ?? ""]))); }} className="grid gap-3 sm:grid-cols-2">
      {fields.map(([k, label, type, , opts]) => (
        <label key={k} className="text-xs font-semibold">{label}
          {type === "select" ? (
            <select data-testid={`${testId}-${k}`} className={`${inp} mt-1`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
              <option value="">Select…</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : <input data-testid={`${testId}-${k}`} required={type !== "optional"} type={type === "optional" ? "text" : type} className={`${inp} mt-1`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
        </label>
      ))}
      <button data-testid={`${testId}-submit`} className="rounded-xl bg-midnight py-2.5 font-semibold text-sand sm:col-span-2 dark:bg-sand dark:text-midnight">{submit}</button>
    </form>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem("wf_admin"));
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const h = { headers: { "X-Admin-Token": token } };
  const { data, refetch } = useQuery({ queryKey: ["admin", token], queryFn: () => http.get("/admin/overview", h).then((r) => r.data), enabled: !!token, retry: false,
    // while a trip refresh is running, keep checking so the panel updates when it finishes
    refetchInterval: (q) => (q.state.data?.refresh?.running ? 15000 : false) });
  if (!token) return <div className="min-h-screen"><Navbar /><Login onToken={setToken} /></div>;
  const post = (url) => async (body) => {
    try { await http.post(url, body, h); toast.success("Saved"); refetch(); qc.invalidateQueries(); return true; }
    catch (e) { toast.error(e.response?.data?.detail?.toString() || "Failed"); return false; }
  };
  const verify = async (id, status) => { await http.patch(`/admin/operators/${id}`, { status }, h); toast.success("Updated"); refetch(); qc.invalidateQueries(); };
  const startRefresh = async () => {
    try { await http.post("/admin/refresh", {}, h); toast.success("Refresh started — it takes a few minutes"); refetch(); }
    catch (e) { toast.error(e.response?.data?.detail?.toString() || "Could not start the refresh"); }
  };
  const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
  const rf = data?.refresh;
  const ops = (data?.operators || []).map((o) => [o.id, o.name]);
  const dests = (meta?.destinations || []).map((d) => [d.slug, d.name]);
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1300px] px-4 py-10 sm:px-8" data-testid="admin-dashboard">
        <div className="flex items-center justify-between"><h1 className="font-display text-4xl">Admin</h1>
          <button data-testid="admin-logout" onClick={() => { sessionStorage.removeItem("wf_admin"); setToken(null); }} className="text-sm underline">Log out</button></div>
        <p className="mt-1 text-sm text-muted-foreground">{data?.counts.departures} departures · {data?.counts.trips} trips · {data?.counts.operators} operators · {data?.alerts} saved alerts</p>
        {rf && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 text-sm" data-testid="admin-refresh">
            <p><b>Trips from operator sites</b> · {rf.every_days > 0 ? `re-read every ${rf.every_days} days` : "automatic refresh is off"}</p>
            <p className="text-muted-foreground">Last read {when(rf.prices_fetched_at)}</p>
            {rf.every_days > 0 && <p className="text-muted-foreground">{rf.running ? "Reading the sites now…" : `Next ${when(rf.next_at)}`}</p>}
            {rf.last && !rf.running && (
              <p className="text-muted-foreground" data-testid="admin-refresh-last">
                {rf.last.error ? `Last run failed: ${rf.last.error}`
                  : rf.last.written ? `Last run: ${rf.last.trips} trips from ${rf.last.operators} operators · ${rf.last.new_trips.length} new · ${rf.last.removed_trips} no longer listed`
                  : `Last run kept the old data: ${rf.last.note}`}
              </p>
            )}
            <button data-testid="admin-refresh-now" onClick={startRefresh} disabled={rf.running} className="ml-auto rounded-xl bg-coral px-4 py-2 font-semibold text-white disabled:opacity-50">{rf.running ? "Refreshing…" : "Refresh now"}</button>
          </div>
        )}
        <Tabs defaultValue="leads" className="mt-6">
          <TabsList className="flex-wrap">
            {["leads", "operators", "add-operator", "add-trip", "add-departure", "signups"].map((t) => <TabsTrigger key={t} value={t} data-testid={`admin-tab-${t}`} className="capitalize">{t.replace("-", " ")}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="leads">
            <div className="overflow-x-auto rounded-2xl bg-card shadow-soft"><table className="w-full text-sm" data-testid="admin-leads-table">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground">{["When", "Name", "Phone", "Party", "Trip", "Operator", "Departure", "Message"].map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead>
              <tbody>{data?.leads.map((l) => <tr key={l.id} className="border-t"><td className="p-3 font-mono text-xs">{l.created_at.slice(0, 16)}</td><td className="p-3">{l.name}</td><td className="p-3">{l.phone}</td><td className="p-3">{l.party_size}</td><td className="p-3">{l.trip_title}</td><td className="p-3">{l.operator_name}</td><td className="p-3">{l.start}</td><td className="p-3 text-xs">{l.message}</td></tr>)}</tbody>
            </table>{!data?.leads.length && <p className="p-6 text-sm text-muted-foreground">No leads yet.</p>}</div>
          </TabsContent>
          <TabsContent value="operators">
            <div className="overflow-x-auto rounded-2xl bg-card shadow-soft"><table className="w-full text-sm">
              <tbody>{data?.operators.map((o) => (
                <tr key={o.id} className="border-t"><td className="p-3 font-semibold">{o.name}</td><td className="p-3 text-xs">{LABELS.op_type[o.category]}</td><td className="p-3">{o.years_active} yrs</td>
                  <td className="p-3"><select data-testid={`admin-verify-${o.id}`} value={o.verified_status} onChange={(e) => verify(o.id, e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-xs">
                    {["verified", "pending", "unverified"].map((s) => <option key={s}>{s}</option>)}</select></td></tr>
              ))}</tbody></table></div>
          </TabsContent>
          <TabsContent value="add-operator"><div className="rounded-2xl bg-card p-6 shadow-soft">
            <Form testId="admin-add-operator" submit="Add operator" onSubmit={(f) => post("/admin/operators")({ ...f, years_active: +f.years_active || 1 })}
              fields={[["name", "Name", "text"], ["category", "Category", "select", "community", Object.entries(LABELS.op_type)], ["website", "Website", "optional"], ["instagram", "Instagram", "optional"], ["years_active", "Years active", "number", 1], ["leader_name", "Lead trip leader", "optional"], ["leader_gender", "Leader gender", "select", "female", [["female", "Female"], ["male", "Male"]]]]} />
          </div></TabsContent>
          <TabsContent value="add-trip"><div className="rounded-2xl bg-card p-6 shadow-soft">
            <Form testId="admin-add-trip" submit="Add trip + first departure"
              onSubmit={(f) => post("/admin/trips")({ ...f, duration_days: +f.duration_days, max_group: +f.max_group, seats_total: +f.max_group, price_inr: +f.price_inr, categories: f.categories ? [f.categories] : [], audience_tags: f.audience_tags ? f.audience_tags.split(",") : ["solo", "friends"], meals: true })}
              fields={[["operator_id", "Operator", "select", "", ops], ["title", "Title", "text"], ["destination_slug", "Destination", "select", "", dests], ["duration_days", "Days", "number", 6],
                ["categories", "Main style", "select", "", Object.entries(STYLES).map(([k, v]) => [k, v.label])], ["audience_tags", "Audience (comma: solo,friends,couples…)", "optional", "solo,friends"],
                ["gender_policy", "Group makeup", "select", "mixed", Object.entries(LABELS.gender)], ["age_band", "Age band", "select", "25-35", Object.entries(LABELS.age)],
                ["stay_tier", "Stay", "select", "budget", Object.entries(LABELS.stay)], ["pace", "Pace", "select", "moderate", Object.entries(LABELS.pace)], ["difficulty", "Difficulty", "select", "easy", Object.entries(LABELS.difficulty)],
                ["max_group", "Max group", "number", 16], ["start_date", "First departure", "date"], ["price_inr", "Listed price ₹", "number"]]} />
          </div></TabsContent>
          <TabsContent value="add-departure"><div className="rounded-2xl bg-card p-6 shadow-soft">
            <Form testId="admin-add-departure" submit="Add departure" onSubmit={(f) => post("/admin/departures")({ ...f, price_inr: +f.price_inr, seats_total: +f.seats_total })}
              fields={[["trip_id", "Trip", "select", "", (data?.trips || []).map((t) => [t.id, t.title])], ["start_date", "Start date", "date"], ["price_inr", "Listed price ₹", "number"], ["seats_total", "Seats", "number", 16]]} />
          </div></TabsContent>
          <TabsContent value="signups">
            <div className="space-y-2">{data?.signups.map((s) => <div key={s.id} className="rounded-2xl bg-card p-4 text-sm shadow-soft"><b>{s.company}</b> · {s.contact_name} · {s.email} · {s.phone} · {LABELS.op_type[s.category]}<p className="text-muted-foreground">{s.message}</p></div>)}
              {!data?.signups.length && <p className="text-sm text-muted-foreground">No operator signups yet.</p>}</div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

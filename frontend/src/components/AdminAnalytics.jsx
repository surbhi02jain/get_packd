import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { http } from "@/lib/api";
import { setTrackingOff, trackingOff } from "@/lib/analytics";

// Admin → Analytics: what visitors did, from getPackd's own event log (backend/src/analytics.ts). People are counted
// once a day (the visitor hash changes daily), so "people" over a period is the sum of each day's.
const INK = "#2b3f99"; // the site's ink, one series per chart
const GRID = "#e7dece";
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];

const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}K` : (n ?? 0).toLocaleString("en-IN"));
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1).replace(/\.0$/, "")}%` : "–");
const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Tile({ label, value, note, testId }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft" data-testid={testId}>
      <p className="text-xs font-medium text-[#5f656b]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#16181b]">{value}</p>
      {note && <p className="mt-0.5 text-xs text-[#5f656b]">{note}</p>}
    </div>
  );
}

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#e7dece] bg-[#fffdf9] px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold text-[#16181b]">{dayLabel(label)}</p>
      <p className="text-[#5b6066]">{payload[0].value.toLocaleString("en-IN")} {unit}</p>
    </div>
  );
}

/** One measure per chart (people a day, Book clicks a day): never two scales on one axis. */
function Trend({ title, data, field, unit, testId }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft" data-testid={testId}>
      <p className="text-sm font-semibold text-[#16181b]">{title}</p>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 176 }}>
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: "#5f656b" }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5f656b" }} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<ChartTip unit={unit} />} cursor={{ stroke: "#5f656b", strokeWidth: 1 }} />
            <Area type="monotone" dataKey={field} stroke={INK} strokeWidth={2} fill={INK} fillOpacity={0.12} dot={false}
              activeDot={{ r: 4, stroke: "#fffdf9", strokeWidth: 2, fill: INK }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** A ranked list with a thin bar for share of the top value; the number is always written out. */
function Ranked({ title, rows, label, value, empty, testId, note }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft" data-testid={testId}>
      <p className="text-sm font-semibold text-[#16181b]">{title}</p>
      {note && <p className="text-xs text-[#5f656b]">{note}</p>}
      {rows.length === 0 ? <p className="mt-3 text-sm text-[#5f656b]">{empty}</p> : (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="py-1.5 pr-3">
                  <span className="block text-[#16181b]">{label(r)}</span>
                  <span className="mt-1 block h-1 rounded-full bg-coral/80" style={{ width: `${Math.max(2, (value(r) / max) * 100)}%` }} aria-hidden />
                </td>
                <td className="w-16 py-1.5 text-right font-semibold tabular-nums text-[#16181b]">{fmt(value(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminAnalytics({ headers }) {
  const [days, setDays] = useState(30);
  const [off, setOff] = useState(trackingOff());
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-analytics", days], queryFn: () => http.get(`/admin/analytics?days=${days}`, headers).then((r) => r.data), refetchInterval: 60_000,
  });
  const t = data?.totals;
  return (
    <div className="space-y-4" data-testid="admin-analytics">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map(([n, l]) => (
          <button key={n} onClick={() => setDays(n)} data-testid={`analytics-range-${n}`}
            className={`chip border ${days === n ? "border-coral bg-coral text-white" : "hover:bg-muted"}`}>{l}</button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-[#5b6066]">
          <input type="checkbox" checked={off} onChange={(e) => { setTrackingOff(e.target.checked); setOff(e.target.checked); }} data-testid="analytics-not-me" />
          Don't count this browser (your own visits)
        </label>
      </div>

      {isError && <p className="text-sm text-[#a3271f]">Couldn't load the analytics.</p>}
      {isLoading && <div className="shimmer h-40 rounded-2xl" />}
      {t && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="People" value={fmt(t.visitors)} note="each counted once a day" testId="analytics-people" />
          <Tile label="Page views" value={fmt(t.views)} />
          <Tile label="Searches" value={fmt(t.searches)} />
          <Tile label="Book clicks" value={fmt(t.book_clicks)} note="went to an operator's site" testId="analytics-book-clicks" />
          <Tile label="Trip page → Book" value={pct(t.book_clicks, t.trip_views)} note={`of ${fmt(t.trip_views)} trip page views`} />
          <Tile label="Saves · shares" value={`${fmt(t.saves)} · ${fmt(t.shares)}`} note="hearts · shortlist links" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Trend title="People a day" data={data.daily} field="visitors" unit="people" testId="analytics-trend-people" />
          <Trend title="Book clicks a day" data={data.daily} field="book_clicks" unit="Book clicks" testId="analytics-trend-clicks" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Ranked title="Book clicks by operator" testId="analytics-by-operator" rows={data.by_operator} label={(r) => <>{r.name} <span className="text-xs text-[#5f656b]">· {fmt(r.people)} {r.people === 1 ? "person" : "people"}</span></>}
            value={(r) => r.clicks} empty="No one has clicked through to an operator yet." note="Clicks on “Book on …”, the leads you send each operator" />
          <Ranked title="Book clicks by trip" rows={data.by_trip} label={(r) => <>{r.title} <span className="text-xs text-[#5f656b]">· {r.operator}</span></>}
            value={(r) => r.clicks} empty="No clicks yet." />
          <Ranked title="What people search for" rows={data.searches} label={(r) => <>{r.q} <span className="text-xs text-[#5f656b]">· {fmt(r.results)} results on average</span></>}
            value={(r) => r.n} empty="No searches with a place yet." />
          <Ranked title="Searches that found nothing" testId="analytics-empty-searches" rows={data.empty_searches} label={(r) => r.q} value={(r) => r.n}
            empty="Every search found something." note="Places or trips people want that the site doesn't have" />
          <Ranked title="Most viewed pages" rows={data.pages} label={(r) => r.path} value={(r) => r.n} empty="No page views yet." />
          <Ranked title="Where visitors come from" rows={data.referrers} label={(r) => r.ref} value={(r) => r.n} empty="No visits from other sites yet (direct visits aren't listed)." />
          <Ranked title="Devices" rows={data.devices} label={(r) => r.device} value={(r) => r.people} empty="No visits yet." note="People, by the device they used" />
          <div className="rounded-2xl bg-card p-4 shadow-soft" data-testid="analytics-errors">
            <p className="text-sm font-semibold text-[#16181b]">Pages that crashed <span className="font-normal text-[#5f656b]">· {fmt(t.errors)}</span></p>
            {data.errors.length === 0 ? <p className="mt-3 text-sm text-[#5f656b]">None. Visitors who hit an error see a “Reload the page” message, and it's listed here.</p> : (
              <ul className="mt-3 space-y-2 text-sm">{data.errors.map((e, i) => (
                <li key={i}><span className="font-medium text-[#16181b]">{e.path}</span> <span className="text-xs text-[#5f656b]">· {new Date(e.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {e.device}</span><br /><span className="text-[#a3271f]">{e.props?.message}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
        <p className="text-xs text-[#5f656b]">Counted by getPackd itself: no cookies, no outside service, and no IP addresses kept. A person is counted once a day, so the same person on two days counts twice. Bots and link previews are left out. Events are deleted after about 13 months.</p>
      </>}
    </div>
  );
}

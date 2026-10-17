// Reads Instagram follower counts for the listed operators and writes data/instagram.json.
// The server runs it alongside the trip refresh when the figures are more than a week old;
// `yarn import:instagram` runs it by hand.
//
// Instagram's own website is never read (it needs a login and its terms forbid automated collection).
// Two sources are used instead:
//   1. Instagram's official Business Discovery API, when IG_USER_ID and IG_ACCESS_TOKEN are set in backend/.env.
//   2. Otherwise Qoruz, a public influencer-analytics directory that lists follower counts by handle
//      and permits automated reading. Its figures are refreshed on its own schedule, so they can lag.
// Only handles confirmed as the operator's own (linked from the operator's website) are looked up.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface OperatorRow {
  id: string;
  name: string;
  website: string;
  instagram: string;
}

export interface InstagramAccount {
  handle: string;
  followers: number;
  /** Where the figure came from: "instagram-api" or "qoruz". */
  source: string;
  /** When the source itself captured the figure (Qoruz refreshes on its own schedule). */
  as_of: string;
  fetched_at: string;
}

// Qoruz figures older than this are ignored: some of its profiles were last captured years ago
const MAX_AGE_DAYS = 400;

interface Figure {
  followers: number;
  as_of: string;
}

async function fromApi(handle: string, userId: string, token: string): Promise<Figure> {
  const fields = `business_discovery.username(${handle}){username,followers_count}`;
  const url = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION || "v21.0"}/${userId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = (await r.json()) as { business_discovery?: { followers_count?: number }; error?: { message?: string } };
  if (!r.ok || typeof body.business_discovery?.followers_count !== "number") throw new Error(body.error?.message ?? `HTTP ${r.status}`);
  return { followers: body.business_discovery.followers_count, as_of: new Date().toISOString() };
}

async function fromQoruz(handle: string): Promise<Figure> {
  const r = await fetch(`https://qoruz.com/${encodeURIComponent(handle)}/instagram`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
  if (r.status === 404) throw new Error("not listed on Qoruz");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  // the page must be for exactly this handle, so a similarly named account is never picked up
  const m = [...html.matchAll(/"username":"([^"]+)"[^{}]{0,300}?"followers_count":(\d+)/g)].find((x) => x[1].toLowerCase() === handle.toLowerCase());
  if (!m) throw new Error("no follower count for this handle on the page");
  // the profile picture's file name carries the time Qoruz last captured this profile
  const captured = /profile_images\/[^"]*_original_(\d{10})/.exec(html);
  if (!captured) throw new Error("Qoruz does not say when it captured this figure");
  const at = Number(captured[1]) * 1000;
  if (Date.now() - at > MAX_AGE_DAYS * 86_400_000) throw new Error(`Qoruz figure is from ${new Date(at).toISOString().slice(0, 7)}, too old to show`);
  return { followers: Number(m[2]), as_of: new Date(at).toISOString() };
}

export async function runInstagramImport(log: (line: string) => void = () => {}) {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  const source = userId && token ? "instagram-api" : "qoruz";
  const file = path.join(ROOT, "data", "instagram.json");
  let previous: Record<string, InstagramAccount> = {};
  try {
    previous = JSON.parse(await readFile(file, "utf8")).accounts ?? {};
  } catch {
    previous = {};
  }
  const operators: OperatorRow[] = JSON.parse(await readFile(path.join(ROOT, "data", "operators.json"), "utf8"));
  const accounts: Record<string, InstagramAccount> = {};
  const failed: { operator_id: string; handle: string; reason: string }[] = [];
  for (const op of operators) {
    const handle = op.instagram.replace(/^@/, "").trim();
    if (!handle) continue;
    try {
      const fig = source === "instagram-api" ? await fromApi(handle, userId!, token!) : await fromQoruz(handle);
      accounts[op.id] = { handle: `@${handle}`, followers: fig.followers, source, as_of: fig.as_of, fetched_at: new Date().toISOString() };
      log(`${op.name.padEnd(34)} @${handle.padEnd(26)} ${String(fig.followers).padStart(9)}  as of ${fig.as_of.slice(0, 10)}`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failed.push({ operator_id: op.id, handle: `@${handle}`, reason });
      // keep the last known figure for the same handle rather than dropping it, as long as it is still recent enough
      const old = previous[op.id];
      if (old?.handle === `@${handle}` && old.as_of && Date.now() - Date.parse(old.as_of) < MAX_AGE_DAYS * 86_400_000) accounts[op.id] = old;
      log(`${op.name.padEnd(34)} @${handle.padEnd(26)} ${accounts[op.id] ? "kept previous figure" : "no figure"}: ${reason}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const fetched_at = new Date().toISOString();
  await mkdir(path.join(ROOT, "data"), { recursive: true });
  await writeFile(file, JSON.stringify({ fetched_at, source, accounts, failed }, null, 1));
  return { fetched_at, source, read: Object.keys(accounts).length, failed: failed.length };
}

// run only when started directly (`yarn import:instagram`), not when the server imports this file
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runInstagramImport(console.log)
    .then((r) => console.log(`\nWrote data/instagram.json from ${r.source}: ${r.read} accounts with a figure, ${r.failed} without. Restart the backend to show them.`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

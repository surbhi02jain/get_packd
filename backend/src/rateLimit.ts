import type { NextFunction, Request, Response } from "express";

/**
 * Per-visitor limits on the public forms and endpoints anyone can call (signups, enquiries, votes, analytics), so a
 * script can't flood them. Counted per IP address in memory: it resets on a restart, which is fine on one server.
 * Behind a proxy the IP comes from X-Forwarded-For (see "trust proxy" in server.ts).
 */
const hits = new Map<string, number[]>();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function limit(name: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}|${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - recent[0])) / 1000)));
      res.status(429).json({ detail: "Too many requests from here. Wait a little and try again." });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

// forget visitors who have gone quiet, so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of hits) if (!ts.length || now - ts[ts.length - 1] > 2 * HOUR) hits.delete(k);
}, 10 * MINUTE).unref();

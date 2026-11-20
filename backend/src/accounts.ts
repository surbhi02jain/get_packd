// Traveller accounts: optional, and only there so a shortlist follows you between devices. Passwords are hashed with
// scrypt and a random salt; a session is a random token the browser keeps, of which we store only a SHA-256 hash.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 64;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(pw, Buffer.from(salt, "base64"), want.length, { N: Number(n), r: Number(r), p: Number(p) });
  return got.length === want.length && timingSafeEqual(got, want);
}

// a password check that always takes as long as a real one, for emails with no account (so timing doesn't tell)
const DUMMY = hashPassword(randomBytes(12).toString("hex"));
export const checkNobody = async (pw: string) => { await checkPassword(pw, await DUMMY); return false; };

export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const SESSION_DAYS = 90;

export const cleanEmail = (e: string) => e.trim().toLowerCase();
export const looksLikeEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// Ten wrong passwords for one email from one address, then a 15-minute wait. Kept in memory: it resets on a restart,
// which is fine for slowing down guessing on a single server.
const FAILS = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60_000, MAX_FAILS = 10;
export function tooManyTries(key: string): boolean {
  const f = FAILS.get(key);
  if (!f) return false;
  if (Date.now() > f.until) { FAILS.delete(key); return false; }
  return f.n >= MAX_FAILS;
}
export function noteFail(key: string) {
  const f = FAILS.get(key);
  if (!f || Date.now() > f.until) FAILS.set(key, { n: 1, until: Date.now() + WINDOW });
  else f.n++;
}
export const clearFails = (key: string) => FAILS.delete(key);

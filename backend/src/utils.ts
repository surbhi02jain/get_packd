// Shared helpers: seeded random numbers, exact rounding and summing, sorting and calendar dates.
// The random/rounding/summing ones follow Python's rules exactly so the seeded sample data never changes.
import { webcrypto } from "node:crypto";

const N = 624;
const M = 397;

/** CPython's `random.Random` (MT19937), limited to the methods the seed generator uses. */
export class PyRandom {
  private mt = new Uint32Array(N);
  private mti = N;

  constructor(seed?: number) {
    this.initByArray(seed === undefined ? Array.from(webcrypto.getRandomValues(new Uint32Array(8))) : [seed >>> 0]);
  }

  private initByArray(key: number[]) {
    const mt = this.mt;
    mt[0] = 19650218;
    for (let i = 1; i < N; i++) {
      mt[i] = Math.imul(1812433253, mt[i - 1] ^ (mt[i - 1] >>> 30)) + i;
    }
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      mt[i] = (mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1664525)) + key[j] + j;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      mt[i] = (mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1566083941)) - i;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
    this.mti = N;
  }

  private next(): number {
    const mt = this.mt;
    if (this.mti >= N) {
      const twist = (a: number, b: number) => {
        const y = (a & 0x80000000) | (b & 0x7fffffff);
        return (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      };
      let kk = 0;
      for (; kk < N - M; kk++) mt[kk] = mt[kk + M] ^ twist(mt[kk], mt[kk + 1]);
      for (; kk < N - 1; kk++) mt[kk] = mt[kk + M - N] ^ twist(mt[kk], mt[kk + 1]);
      mt[N - 1] = mt[M - 1] ^ twist(mt[N - 1], mt[0]);
      this.mti = 0;
    }
    let y = mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.next() >>> 5;
    const b = this.next() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  private randbelow(n: number): number {
    const k = 32 - Math.clz32(n);
    let r = this.next() >>> (32 - k);
    while (r >= n) r = this.next() >>> (32 - k);
    return r;
  }

  randint(a: number, b: number): number {
    return a + this.randbelow(b - a + 1);
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  choice<T>(seq: readonly T[]): T {
    return seq[this.randbelow(seq.length)];
  }

  sample<T>(population: readonly T[], k: number): T[] {
    const n = population.length;
    const result: T[] = [];
    let setsize = 21;
    if (k > 5) setsize += 4 ** Math.ceil(Math.log(k * 3) / Math.log(4));
    if (n <= setsize) {
      const pool = [...population];
      for (let i = 0; i < k; i++) {
        const j = this.randbelow(n - i);
        result.push(pool[j]);
        pool[j] = pool[n - i - 1];
      }
    } else {
      const selected = new Set<number>();
      for (let i = 0; i < k; i++) {
        let j = this.randbelow(n);
        while (selected.has(j)) j = this.randbelow(n);
        selected.add(j);
        result.push(population[j]);
      }
    }
    return result;
  }
}

/** Python's `round()`: correctly rounded on the exact value of the double, ties to even. */
export function pyRound(x: number, ndigits = 0): number {
  const abs = Math.abs(x);
  if (!Number.isFinite(x) || abs >= 1e21) return x;
  const scaled = BigInt(abs.toFixed(100).replace(".", ""));
  const div = 10n ** BigInt(100 - ndigits);
  let q = scaled / div;
  const twice = (scaled % div) * 2n;
  if (twice > div || (twice === div && q % 2n === 1n)) q += 1n;
  const r = ndigits >= 0 ? Number(q) / 10 ** ndigits : Number(q) * 10 ** -ndigits;
  return x < 0 ? -r : r;
}

/**
 * Python's built-in `sum()` (3.12+), which uses compensated summation for floats but not for ints.
 * `isFloat` tells the two apart for values that were ints on the Python side.
 */
export function pySum(xs: readonly number[], isFloat: (x: number) => boolean = () => true): number {
  let i = 0;
  let total = 0;
  while (i < xs.length && !isFloat(xs[i])) total += xs[i++];
  if (i === xs.length) return total;
  total += xs[i++];
  let c = 0;
  for (; i < xs.length; i++) {
    const x = xs[i];
    if (isFloat(x)) {
      const t = total + x;
      c += Math.abs(total) >= Math.abs(x) ? total - t + x : x - t + total;
      total = t;
    } else {
      total += x;
    }
  }
  return c && Number.isFinite(c) ? total + c : total;
}

/** Python's `int(str)`; throws on anything that is not a plain integer literal. */
export function pyInt(s: string): number {
  if (!/^\s*[+-]?\d+\s*$/.test(s)) throw new Error(`invalid literal for int() with base 10: '${s}'`);
  return Number(s);
}

/** Python's `str.title()`. */
export function titleCase(s: string): string {
  return s.replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Python's `dict.get(key, default)` for plain objects, ignoring inherited properties. */
export function lookup<T>(o: Record<string, T>, key: string, dflt: NoInfer<T>): T {
  return Object.hasOwn(o, key) ? o[key] : dflt;
}

/** Orders two key tuples the way Python orders tuples. */
export function cmpTuple(a: readonly (number | string)[], b: readonly (number | string)[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

// ---------- dates (calendar dates are kept as "YYYY-MM-DD" strings, which sort chronologically) ----------
const DAY_MS = 86_400_000;

function toDays(iso: string): number {
  const d = new Date(0);
  d.setUTCFullYear(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round(d.getTime() / DAY_MS);
}

function fromDays(days: number): string {
  const d = new Date(days * DAY_MS);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Python's `date.fromisoformat()`, returning the canonical ISO string or null when invalid. */
export function parseISODate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m || m[1] === "0000") return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return fromDays(toDays(iso)) === iso ? iso : null;
}

export function addDays(iso: string, n: number): string {
  return fromDays(toDays(iso) + n);
}

/** Monday = 0 … Sunday = 6, like `date.weekday()`. */
export function weekday(iso: string): number {
  return (((toDays(iso) + 3) % 7) + 7) % 7;
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  return addDays(monthStart(addDays(monthStart(iso), 31)), -1);
}

/** Same shape as Python's `datetime.now(timezone.utc).isoformat()`. */
export function pyIso(d: Date): string {
  return d.toISOString().replace("Z", "000+00:00");
}

export function nowIso(): string {
  return pyIso(new Date());
}

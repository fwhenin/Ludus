// Core Roman numeral maths. Everything else in the app leans on these.

export const TOKEN_TABLE = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
] as const;

export type Token = (typeof TOKEN_TABLE)[number][0];

export const ALL_TOKENS: Token[] = TOKEN_TABLE.map(([t]) => t);
export const SUBTRACTIVE: Token[] = ['IV', 'IX', 'XL', 'XC', 'CD', 'CM'];
export const SYMBOLS = ['I', 'V', 'X', 'L', 'C', 'D', 'M'] as const;
export const SYMBOL_VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
export const MAX = 3999;

/** Canonical building blocks of n, largest first (e.g. 14 -> X, IV). */
export function tokenize(n: number): Token[] {
  const out: Token[] = [];
  for (const [t, v] of TOKEN_TABLE) {
    while (n >= v) {
      out.push(t);
      n -= v;
    }
  }
  return out;
}

export function toRoman(n: number): string {
  return tokenize(n).join('');
}

/**
 * Value of any string of Roman symbols using the "smaller before larger
 * subtracts" rule, without checking that the form is the standard one.
 * IIII -> 4, IL -> 49. Returns null for non-Roman characters.
 */
export function looseValue(s: string): number | null {
  if (!s || /[^IVXLCDM]/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = SYMBOL_VALUE[s[i]];
    const next = SYMBOL_VALUE[s[i + 1]] ?? 0;
    total += next > v ? -v : v;
  }
  return total;
}

/** Strict parse: only the standard form of 1..3999 is accepted. */
export function fromRoman(s: string): number | null {
  const up = s.toUpperCase();
  const v = looseValue(up);
  if (v === null || v < 1 || v > MAX) return null;
  return toRoman(v) === up ? v : null;
}

/** The "mason's mistake" form with no subtraction: 4 -> IIII, 90 -> LXXXX. */
export function additiveForm(n: number): string {
  let out = '';
  for (const [t, v] of TOKEN_TABLE) {
    if (t.length > 1) continue;
    while (n >= v) {
      out += t;
      n -= v;
    }
  }
  return out;
}

/** Split by decimal place: 1994 -> M (1000), CM (900), XC (90), IV (4). */
export function parts(n: number): { roman: string; value: number }[] {
  const out: { roman: string; value: number }[] = [];
  for (const place of [1000, 100, 10, 1]) {
    const value = Math.floor(n / place) % 10 * place;
    if (value > 0) out.push({ roman: toRoman(value), value });
  }
  return out;
}

/** Individual symbols a set of tokens needs, in ascending order. */
export function symbolsFor(tokens: readonly Token[]): string[] {
  const used = new Set(tokens.join('').split(''));
  return SYMBOLS.filter((s) => used.has(s));
}

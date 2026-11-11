// Dynamic quiz generation. Every question is validated before it is returned.

import { MAX, Token, additiveForm, fromRoman, looseValue, toRoman, tokenize } from './roman';

/** What a learner is expected to know at a point in the curriculum. */
export interface Level {
  key: string;
  tokens: Token[];
  min: number;
  max: number;
  /** Newly introduced ideas; numbers using them are favoured. */
  focus: Token[];
  /** Only numerals at least this long (used for "long numeral" drills). */
  minLen?: number;
  /** Numbers that must appear in a quiz at this level. */
  include?: number[];
}

export type Dir = 'r2a' | 'a2r';
export type QType = 'mc' | 'fill';
export interface QuizOptions {
  dir: Dir | 'mixed';
  type: QType | 'mixed';
  count: number;
  /** Extra per-number weighting, e.g. to target a learner's weak spots. */
  weights?: (n: number) => number;
  rng?: () => number;
}

export interface Question {
  n: number;
  dir: Dir;
  type: QType;
  prompt: string;
  answer: string;
  options?: string[];
}

export function fits(n: number, level: Level): boolean {
  if (!Number.isInteger(n) || n < level.min || n > level.max) return false;
  const allowed = new Set<string>(level.tokens);
  if (!tokenize(n).every((t) => allowed.has(t))) return false;
  if (level.minLen && toRoman(n).length < level.minLen) return false;
  return true;
}

const poolCache = new Map<string, number[]>();
export function pool(level: Level): number[] {
  let p = poolCache.get(level.key);
  if (!p) {
    p = [];
    for (let n = Math.max(1, level.min); n <= Math.min(MAX, level.max); n++) if (fits(n, level)) p.push(n);
    poolCache.set(level.key, p);
  }
  return p;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Precomputes cumulative weights once so each pick is a binary search. */
function weightedPicker(nums: number[], weight: (n: number) => number, rng: () => number): () => number {
  let total = 0;
  const w = nums.map((n) => (total += Math.max(0, weight(n))));
  return () => {
    const r = rng() * total;
    let lo = 0;
    let hi = w.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (w[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    return nums[lo];
  };
}

function deltas(n: number): number[] {
  const d = [1, 2, 5, 10];
  if (n >= 40) d.push(20, 50);
  if (n >= 100) d.push(100);
  if (n >= 400) d.push(500);
  if (n >= 1000) d.push(1000);
  return d;
}

function swaps(roman: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < roman.length - 1; i++) {
    if (roman[i] !== roman[i + 1]) out.push(roman.slice(0, i) + roman[i + 1] + roman[i] + roman.slice(i + 2));
  }
  return out;
}

/** Wrong numbers that mimic real misreadings of a numeral. */
function arabicDistractors(n: number, rng: () => number): string[] {
  const roman = toRoman(n);
  const ok = (v: number | null): v is number => v !== null && Number.isInteger(v) && v > 0 && v <= 4999 && v !== n;
  // Typical slips first: ignoring subtraction (IX read as 11) or flipping a pair.
  const smart = [additiveSum(roman), ...swaps(roman).map(looseValue)].filter(ok);
  const near = deltas(n).flatMap((d) => [n + d, n - d]).filter(ok);
  const out = new Set<number>(shuffle(smart, rng).slice(0, 2));
  for (const v of shuffle(near, rng)) {
    if (out.size >= 3) break;
    out.add(v);
  }
  return [...out].map(String);
}

function additiveSum(roman: string): number {
  return roman.split('').reduce((sum, ch) => sum + (looseValue(ch) ?? 0), 0);
}

/** Wrong numerals: malformed spellings of n, plus correct spellings of near misses. */
function romanDistractors(n: number, level: Level, rng: () => number): string[] {
  const answer = toRoman(n);
  const neighbours = shuffle(
    deltas(n).flatMap((d) => [n + d, n - d]).filter((v) => v >= 1 && v <= MAX),
    rng,
  );
  const malformed = shuffle([additiveForm(n), ...swaps(answer)], rng).slice(0, 2);
  const inLevel = neighbours.filter((v) => fits(v, level)).map(toRoman);
  const outOfLevel = neighbours.filter((v) => !fits(v, level));
  const candidates = [
    ...malformed,
    ...inLevel,
    ...outOfLevel.map(additiveForm),
    ...outOfLevel.map(toRoman),
    answer + 'I',
  ];
  const out = new Set<string>();
  for (const c of candidates) {
    if (out.size >= 3) break;
    if (c && c !== answer) out.add(c);
  }
  return [...out];
}

function build(n: number, dir: Dir, type: QType, level: Level, rng: () => number): Question {
  const roman = toRoman(n);
  const q: Question =
    dir === 'r2a'
      ? { n, dir, type, prompt: roman, answer: String(n) }
      : { n, dir, type, prompt: String(n), answer: roman };
  if (type === 'mc') {
    const wrong = dir === 'r2a' ? arabicDistractors(n, rng) : romanDistractors(n, level, rng);
    q.options = shuffle([q.answer, ...wrong], rng);
  }
  return q;
}

/** Returns a list of problems with a question; empty means it is safe to show. */
export function validateQuestion(q: Question, level: Level): string[] {
  const errs: string[] = [];
  if (!fits(q.n, level)) errs.push(`${q.n} is outside level ${level.key}`);
  const roman = toRoman(q.n);
  if (fromRoman(roman) !== q.n) errs.push(`${q.n} does not round-trip`);
  if (q.dir === 'r2a') {
    if (q.prompt !== roman) errs.push('prompt is not the standard numeral');
    if (q.answer !== String(q.n)) errs.push('answer is not the number');
  } else {
    if (q.prompt !== String(q.n)) errs.push('prompt is not the number');
    if (q.answer !== roman) errs.push('answer is not the standard numeral');
  }
  if (q.type === 'mc') {
    const opts = q.options ?? [];
    if (opts.length !== 4) errs.push(`expected 4 options, got ${opts.length}`);
    if (new Set(opts).size !== opts.length) errs.push('duplicate options');
    if (opts.filter((o) => o === q.answer).length !== 1) errs.push('answer must appear exactly once');
    // No distractor may be a second correct answer.
    for (const o of opts) {
      if (o === q.answer) continue;
      if (q.dir === 'r2a' ? Number(o) === q.n : fromRoman(o) === q.n) errs.push(`option ${o} is also correct`);
    }
  } else if (q.options) {
    errs.push('fill-in question has options');
  }
  return errs;
}

export function generateQuiz(level: Level, opts: QuizOptions): Question[] {
  const rng = opts.rng ?? Math.random;
  const nums = pool(level);
  if (nums.length === 0) throw new Error(`Level ${level.key} has no numbers`);
  const focus = new Set<string>(level.focus);
  const weight = (n: number) =>
    (focus.size && tokenize(n).some((t) => focus.has(t)) ? 6 : 1) * (opts.weights?.(n) ?? 1);
  const pickNumber = weightedPicker(nums, weight, rng);
  const forced = (level.include ?? []).filter((n) => fits(n, level));

  const used = new Set<string>();
  const out: Question[] = [];
  for (let i = 0; i < opts.count; i++) {
    let made: Question | null = null;
    for (let attempt = 0; attempt < 60 && !made; attempt++) {
      const isForced = i < forced.length;
      const n = isForced ? forced[i] : pickNumber();
      // A forced number is best practised by writing it out.
      const dir: Dir = opts.dir === 'mixed' ? (isForced || rng() < 0.5 ? 'a2r' : 'r2a') : opts.dir;
      const type: QType = opts.type === 'mixed' ? (isForced || rng() < 0.5 ? 'fill' : 'mc') : opts.type;
      const key = `${n}:${dir}`;
      // Avoid repeats until a small pool (e.g. I, II, III) makes them unavoidable.
      if (used.has(key) && attempt < 30) continue;
      const q = build(n, dir, type, level, rng);
      if (validateQuestion(q, level).length === 0) {
        used.add(key);
        made = q;
      }
    }
    if (!made) throw new Error(`Could not generate a valid question for level ${level.key}`);
    out.push(made);
  }
  return out;
}

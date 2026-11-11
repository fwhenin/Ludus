// Progress rules: unlocking, XP, laurels, streaks and achievements. Pure functions.

import { GROUPS, Group, Lesson } from './curriculum';
import type { Dir, Level, QType } from './generator';
import { tokenize } from './roman';
import type { Passed, Save } from './storage';

export const PASS_MARK = 0.8;
export const SPEED_SECONDS = 60;

export const RANKS = [
  { name: 'Tiro', xp: 0, note: 'Fresh recruit' },
  { name: 'Discipulus', xp: 100, note: 'Student' },
  { name: 'Legionary', xp: 300, note: 'Soldier of the legion' },
  { name: 'Centurion', xp: 700, note: 'Commander of a hundred' },
  { name: 'Senator', xp: 1300, note: 'Voice of Rome' },
  { name: 'Consul', xp: 2200, note: 'Leader of the Republic' },
  { name: 'Imperator', xp: 3500, note: 'Master of numerals' },
];

export function rankFor(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return { index: i, ...RANKS[i], next, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

export const ACHIEVEMENTS = [
  { id: 'first', icon: '📖', name: 'Prima Lectio', desc: 'Pass your first lesson.' },
  { id: 'perfect', icon: '💎', name: 'Sine Errore', desc: 'Score 100% on a group trial.' },
  { id: 'testout', icon: '⚡', name: 'Veni, Vidi, Vici', desc: 'Pass a trial without finishing its lessons.' },
  { id: 'laureatus', icon: '🌿', name: 'Laureatus', desc: 'Earn three laurels on every lesson in a group.' },
  { id: 'streak3', icon: '🔥', name: 'Tres Dies', desc: 'Practise three days in a row.' },
  { id: 'streak7', icon: '☀️', name: 'Septimana', desc: 'Practise seven days in a row.' },
  { id: 'speed10', icon: '🪽', name: 'Mercury\'s Sandals', desc: 'Get 10 right in one speed round.' },
  { id: 'speed20', icon: '🌩️', name: 'Jupiter\'s Lightning', desc: 'Get 20 right in one speed round.' },
  { id: 'weak', icon: '🛠️', name: 'Repetitio', desc: 'Finish a weak-spots practice.' },
  { id: 'centum', icon: '💯', name: 'Centum', desc: 'Answer 100 questions correctly.' },
  { id: 'year', icon: '📅', name: 'Anno Domini', desc: 'Write the current year in Roman numerals.' },
  { id: 'graduate', icon: '👑', name: 'Imperator Numerorum', desc: 'Pass all five trials.' },
];

export const lessonPassed = (save: Save, id: string) => !!save.lessons[id];
export const groupPassed = (save: Save, id: string) => !!save.trials[id];

export function groupUnlocked(save: Save, group: Group): boolean {
  const i = GROUPS.indexOf(group);
  return i === 0 || groupPassed(save, GROUPS[i - 1].id);
}

export function lessonUnlocked(save: Save, lesson: Lesson): boolean {
  const group = GROUPS.find((g) => g.id === lesson.group)!;
  if (!groupUnlocked(save, group)) return false;
  const i = group.lessons.indexOf(lesson);
  return i === 0 || lessonPassed(save, group.lessons[i - 1].id);
}

/** The next thing the learner should do, for the "Continue" button. */
export function nextUp(save: Save): { lesson?: Lesson; trial?: Group } | null {
  for (const g of GROUPS) {
    if (groupPassed(save, g.id)) continue;
    const lesson = g.lessons.find((l) => !lessonPassed(save, l.id));
    return lesson ? { lesson } : { trial: g };
  }
  return null;
}

/** Levels the learner may practise: finished groups, plus where they are now. */
export function practiceLevels(save: Save): { key: string; label: string; level: Level }[] {
  const out: { key: string; label: string; level: Level }[] = [];
  for (const g of GROUPS) {
    if (groupPassed(save, g.id)) {
      out.push({ key: g.id, label: `Ludus ${g.num}: ${g.title}`, level: g.trial });
      continue;
    }
    if (!groupUnlocked(save, g)) break;
    const done = g.lessons.filter((l) => lessonPassed(save, l.id));
    const last = done[done.length - 1];
    if (last) {
      // Drop the lesson's own emphasis and narrow range so practice is a fair mix.
      const level: Level = { key: `upto-${last.id}`, tokens: last.level.tokens, min: 1, max: last.level.max, focus: [] };
      out.push({ key: level.key, label: `Ludus ${g.num} so far (up to "${last.title}")`, level });
    }
    break;
  }
  return out;
}

export function weakWeights(save: Save): ((n: number) => number) | null {
  const stats = save.tokenStats;
  if (!Object.values(stats).some((s) => s.wrong > 0)) return null;
  return (n) => 1 + tokenize(n).reduce((sum, t) => sum + (stats[t]?.seen ? (8 * stats[t].wrong) / stats[t].seen : 0), 0);
}

export interface Answer {
  n: number;
  dir: Dir;
  type: QType;
  correct: boolean;
}

export interface QuizResult {
  kind: 'lesson' | 'trial' | 'practice' | 'weak' | 'speed';
  /** Lesson id, group id, or practice level key. */
  ref: string;
  label: string;
  answers: Answer[];
  ms: number;
}

export interface Summary {
  correct: number;
  total: number;
  passed: boolean;
  laurels: number;
  xp: number;
  newAchievements: string[];
  rankUp?: string;
  personalBest?: boolean;
  previousBest?: number;
  unlocked?: string;
}

export function laurelsFor(correct: number, total: number): number {
  const r = total ? correct / total : 0;
  return r >= 1 ? 3 : r >= 0.9 ? 2 : r >= PASS_MARK ? 1 : 0;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function better(prev: Passed | undefined, laurels: number, ratio: number, at: string): Passed {
  return { laurels: Math.max(prev?.laurels ?? 0, laurels), best: Math.max(prev?.best ?? 0, ratio), at: prev?.testedOut ? at : prev?.at ?? at };
}

export function applyResult(old: Save, result: QuizResult, now = new Date()): { save: Save; summary: Summary } {
  const save: Save = structuredClone(old);
  const at = now.toISOString();
  const total = result.answers.length;
  const correct = result.answers.filter((a) => a.correct).length;
  const ratio = total ? correct / total : 0;
  const graded = result.kind === 'lesson' || result.kind === 'trial';
  const passed = graded && ratio >= PASS_MARK;
  const laurels = graded ? laurelsFor(correct, total) : 0;
  const earned: string[] = [];
  const grant = (id: string) => {
    if (!save.achievements[id]) {
      save.achievements[id] = at;
      earned.push(id);
    }
  };
  const summary: Summary = { correct, total, passed, laurels, xp: 0, newAchievements: earned };

  // Per-concept stats feed the weak-spots practice.
  for (const a of result.answers) {
    for (const t of new Set(tokenize(a.n))) {
      const s = (save.tokenStats[t] ??= { seen: 0, wrong: 0 });
      s.seen++;
      if (!a.correct) s.wrong++;
    }
  }

  let xp = correct * (result.kind === 'speed' ? 3 : graded ? 10 : 5);

  if (result.kind === 'lesson' && passed) {
    const firstTime = !save.lessons[result.ref] || save.lessons[result.ref].testedOut;
    save.lessons[result.ref] = better(save.lessons[result.ref], laurels, ratio, at);
    if (firstTime) xp += 20;
    grant('first');
  }

  if (result.kind === 'trial' && passed) {
    const gi = GROUPS.findIndex((g) => g.id === result.ref);
    const group = GROUPS[gi];
    const firstTime = !save.trials[group.id] || save.trials[group.id].testedOut;
    if (group.lessons.some((l) => !save.lessons[l.id])) grant('testout');
    save.trials[group.id] = better(save.trials[group.id], laurels, ratio, at);
    // Passing a trial proves everything up to here, so credit it all.
    const credit: Passed = { laurels: 0, best: 0, at, testedOut: true };
    for (const g of GROUPS.slice(0, gi + 1)) {
      save.trials[g.id] ??= { ...credit };
      for (const l of g.lessons) save.lessons[l.id] ??= { ...credit };
    }
    if (firstTime) {
      xp += 50;
      summary.unlocked = GROUPS[gi + 1] ? `Ludus ${GROUPS[gi + 1].num}: ${GROUPS[gi + 1].title}` : undefined;
    }
    if (ratio === 1) grant('perfect');
    if (GROUPS.every((g) => save.trials[g.id])) grant('graduate');
  }

  if (graded && ratio === 1) xp += 15;

  if (result.kind === 'speed') {
    const prev = save.speedBest[result.ref] ?? 0;
    summary.previousBest = prev;
    if (correct > prev) {
      save.speedBest[result.ref] = correct;
      summary.personalBest = true;
    }
    if (correct >= 10) grant('speed10');
    if (correct >= 20) grant('speed20');
  }

  if (result.kind === 'weak' && total > 0) grant('weak');

  const year = now.getFullYear();
  if (result.answers.some((a) => a.correct && a.n === year && a.dir === 'a2r' && a.type === 'fill')) grant('year');

  if (GROUPS.some((g) => g.lessons.every((l) => save.lessons[l.id]?.laurels === 3))) grant('laureatus');

  save.totalCorrect += correct;
  if (save.totalCorrect >= 100) grant('centum');

  // Daily streak: any finished quiz counts for the day.
  if (total > 0) {
    const today = dayKey(now);
    if (save.streak.last !== today) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      save.streak.count = save.streak.last === dayKey(y) ? save.streak.count + 1 : 1;
      save.streak.last = today;
      save.streak.best = Math.max(save.streak.best, save.streak.count);
    }
    if (save.streak.count >= 3) grant('streak3');
    if (save.streak.count >= 7) grant('streak7');
  }

  const before = rankFor(save.xp);
  save.xp += xp;
  summary.xp = xp;
  const after = rankFor(save.xp);
  if (after.index > before.index) summary.rankUp = after.name;

  save.history.unshift({ at, kind: result.kind, label: result.label, correct, total, ms: result.ms, passed: graded ? passed : undefined });
  save.history.length = Math.min(save.history.length, 200);

  return { save, summary };
}

/** Streak shown to the user: lapses if they skipped yesterday. */
export function currentStreak(save: Save, now = new Date()): number {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return save.streak.last === dayKey(now) || save.streak.last === dayKey(y) ? save.streak.count : 0;
}

import { describe, expect, it } from 'vitest';
import { GROUPS, LESSONS } from '../src/lib/curriculum';
import { applyResult, currentStreak, streakAtRisk, groupUnlocked, lessonUnlocked, practiceLevels, Answer, SKIPPED_LESSON_XP, SKIPPED_TRIAL_XP } from '../src/lib/game';
import { Dir, QType, fits, generateQuiz, pool, validateQuestion } from '../src/lib/generator';
import { additiveForm, fromRoman, looseValue, parts, toRoman } from '../src/lib/roman';
import { freshSave, parseImport, sanitize } from '../src/lib/storage';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('roman', () => {
  it('round-trips every number from 1 to 3999', () => {
    for (let n = 1; n <= 3999; n++) expect(fromRoman(toRoman(n))).toBe(n);
  });
  it('converts known values', () => {
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(toRoman(3888)).toBe('MMMDCCCLXXXVIII');
    expect(toRoman(49)).toBe('XLIX');
    expect(fromRoman('xiv')).toBe(14);
  });
  it('rejects non-standard forms', () => {
    for (const bad of ['IIII', 'IL', 'VX', 'IC', 'MMMM', 'XXXX', 'IIV', 'ABC', '']) expect(fromRoman(bad)).toBeNull();
  });
  it('explains near misses', () => {
    expect(looseValue('IIII')).toBe(4);
    expect(additiveForm(49)).toBe('XXXXVIIII');
    expect(parts(1994)).toEqual([
      { roman: 'M', value: 1000 },
      { roman: 'CM', value: 900 },
      { roman: 'XC', value: 90 },
      { roman: 'IV', value: 4 },
    ]);
  });
});

describe('curriculum', () => {
  it('lesson content only uses what has been taught', () => {
    for (const l of LESSONS) {
      for (const c of l.cards) {
        if (c.t === 'tap' || c.t === 'build') {
          expect(fits(c.n, { ...l.level, min: 1, minLen: undefined, max: 3999 }), `${l.id} card ${c.n}`).toBe(true);
        }
        if (c.t === 'build' && c.wrong) {
          expect(looseValue(c.wrong), `${l.id} ${c.wrong}`).toBe(c.n);
          expect(fromRoman(c.wrong)).toBeNull();
        }
        if (c.t === 'pick') expect(c.options[c.answer]).toBeDefined();
        if (c.t === 'rule') expect(fits(fromRoman(c.numeral)!, { ...l.level, min: 1, minLen: undefined, max: 3999 }), `${l.id} ${c.numeral}`).toBe(true);
        if (c.t === 'flip') {
          expect(l.level.tokens, `${l.id} ${c.small}${c.big}`).toContain(c.small + c.big);
          expect(fromRoman(c.big + c.small)).not.toBeNull();
        }
      }
    }
  });
  it('every level has numbers to ask about', () => {
    for (const l of LESSONS) expect(pool(l.level).length, l.id).toBeGreaterThanOrEqual(3);
    for (const g of GROUPS) expect(pool(g.trial).length, g.id).toBeGreaterThanOrEqual(12);
  });
});

describe('generator', () => {
  const dirs: (Dir | 'mixed')[] = ['r2a', 'a2r', 'mixed'];
  const types: (QType | 'mixed')[] = ['mc', 'fill', 'mixed'];
  it('produces only valid questions at every level and setting', () => {
    const levels = [...LESSONS.map((l) => l.level), ...GROUPS.map((g) => g.trial)];
    let seed = 1;
    for (const level of levels) {
      for (const dir of dirs) {
        for (const type of types) {
          for (let run = 0; run < 15; run++) {
            const qs = generateQuiz(level, { dir, type, count: 12, rng: rng(seed++) });
            expect(qs).toHaveLength(12);
            for (const q of qs) {
              expect(validateQuestion(q, level), `${level.key} ${JSON.stringify(q)}`).toEqual([]);
              if (dir !== 'mixed') expect(q.dir).toBe(dir);
              if (type !== 'mixed') expect(q.type).toBe(type);
            }
          }
        }
      }
    }
  });
  it('avoids repeats when the pool allows', () => {
    const qs = generateQuiz(GROUPS[3].trial, { dir: 'mixed', type: 'mixed', count: 20, rng: rng(7) });
    expect(new Set(qs.map((q) => `${q.n}:${q.dir}`)).size).toBe(20);
  });
  it('catches a broken question', () => {
    const level = GROUPS[1].trial;
    expect(validateQuestion({ n: 14, dir: 'a2r', type: 'mc', prompt: '14', answer: 'XIV', options: ['XIV', 'XIV', 'XVI', 'XIIII'] }, level)).not.toEqual([]);
    expect(validateQuestion({ n: 50, dir: 'r2a', type: 'fill', prompt: 'L', answer: '50' }, level)).not.toEqual([]);
  });
  it('includes the current year in the years lesson', () => {
    const year = new Date().getFullYear();
    const qs = generateQuiz(GROUPS[4].lessons[0].level, { dir: 'mixed', type: 'mixed', count: 5, rng: rng(3) });
    expect(qs[0]).toMatchObject({ n: year, dir: 'a2r', type: 'fill' });
  });
});

describe('progress', () => {
  const answers = (right: number, total: number): Answer[] =>
    Array.from({ length: total }, (_, i) => ({ n: i + 1, dir: 'r2a', type: 'mc', correct: i < right }));

  it('starts locked and unlocks lesson by lesson', () => {
    let save = freshSave();
    const [l1, l2] = GROUPS[0].lessons;
    expect(lessonUnlocked(save, l1)).toBe(true);
    expect(lessonUnlocked(save, l2)).toBe(false);
    expect(groupUnlocked(save, GROUPS[1])).toBe(false);
    expect(practiceLevels(save)).toHaveLength(0);
    save = applyResult(save, { kind: 'lesson', ref: l1.id, label: '', answers: answers(3, 5), ms: 1 }).save;
    expect(lessonUnlocked(save, l2)).toBe(false);
    const r = applyResult(save, { kind: 'lesson', ref: l1.id, label: '', answers: answers(5, 5), ms: 1 });
    expect(r.summary).toMatchObject({ passed: true, laurels: 3 });
    expect(r.summary.newAchievements).toContain('first');
    expect(lessonUnlocked(r.save, l2)).toBe(true);
    expect(practiceLevels(r.save)).toHaveLength(1);
  });

  it('testing out of a later group credits everything before it', () => {
    const r = applyResult(freshSave(), { kind: 'trial', ref: 'g4', label: '', answers: answers(10, 12), ms: 1 });
    expect(r.summary.passed).toBe(true);
    expect(r.summary.newAchievements).toContain('testout');
    expect(groupUnlocked(r.save, GROUPS[4])).toBe(true);
    expect(lessonUnlocked(r.save, GROUPS[4].lessons[0])).toBe(true);
    expect(r.save.lessons['g2l1'].testedOut).toBe(true);
    // 14 skipped lessons and 3 skipped earlier trials are paid as bare passes.
    expect(r.summary.skippedXp).toBe(14 * SKIPPED_LESSON_XP + 3 * SKIPPED_TRIAL_XP);
    expect(r.summary.xp).toBe(10 * 10 + 50 + r.summary.skippedXp!);
    expect(r.summary.newAchievements).toContain('first');
    // Replaying a skipped lesson earns laurels but not a second bonus.
    const replay = applyResult(r.save, { kind: 'lesson', ref: 'g2l1', label: '', answers: answers(4, 5), ms: 1 });
    expect(replay.summary.xp).toBe(40);
    expect(replay.save.lessons['g2l1'].laurels).toBe(1);
    // Retaking the same trial pays nothing extra for skipped content.
    const again = applyResult(r.save, { kind: 'trial', ref: 'g4', label: '', answers: answers(10, 12), ms: 1 });
    expect(again.summary.skippedXp).toBeUndefined();
    expect(again.summary.xp).toBe(100);
    const fail = applyResult(freshSave(), { kind: 'trial', ref: 'g4', label: '', answers: answers(9, 12), ms: 1 });
    expect(groupUnlocked(fail.save, GROUPS[1])).toBe(false);
  });

  it('tracks streaks and speed bests', () => {
    let save = freshSave();
    const day = (d: number) => new Date(2026, 0, d, 12);
    for (const d of [1, 2, 3]) save = applyResult(save, { kind: 'practice', ref: 'g1', label: '', answers: answers(1, 1), ms: 1 }, day(d)).save;
    expect(save.streak.count).toBe(3);
    expect(save.achievements.streak3).toBeDefined();
    save = applyResult(save, { kind: 'practice', ref: 'g1', label: '', answers: answers(1, 1), ms: 1 }, day(6)).save;
    expect(save.streak.count).toBe(1);
    const s = applyResult(save, { kind: 'speed', ref: 'g1', label: '', answers: answers(11, 12), ms: 1 }, day(6));
    expect(s.summary.personalBest).toBe(true);
    expect(s.save.speedBest.g1).toBe(11);
  });

  it('survives export and import, and rejects junk', () => {
    const save = applyResult(freshSave(), { kind: 'trial', ref: 'g2', label: 'x', answers: answers(12, 12), ms: 1 }).save;
    expect(parseImport(JSON.stringify({ app: 'ludus', save }))).toEqual(sanitize(JSON.parse(JSON.stringify(save))));
    expect(parseImport(JSON.stringify(save))?.xp).toBe(save.xp);
    expect(parseImport('not json')).toBeNull();
    expect(parseImport('{"v":2}')).toBeNull();
  });
});

describe('quality of life', () => {
  it('flags a streak that will lapse unless the learner plays today', () => {
    const save = freshSave();
    save.streak = { count: 4, best: 4, last: '2026-03-09' };
    expect(streakAtRisk(save, new Date(2026, 2, 10, 9))).toBe(4);
    save.streak.last = '2026-03-10';
    expect(streakAtRisk(save, new Date(2026, 2, 10, 9))).toBe(0);
    save.streak.last = '2026-03-07';
    expect(currentStreak(save, new Date(2026, 2, 10, 9))).toBe(0);
    expect(streakAtRisk(save, new Date(2026, 2, 10, 9))).toBe(0);
  });
  it('keeps a valid theme and drops junk', () => {
    const save = freshSave();
    expect(save.settings.theme).toBe('system');
    expect(sanitize({ ...save, settings: { ...save.settings, theme: 'dark' } })!.settings.theme).toBe('dark');
    expect(sanitize({ ...save, settings: { ...save.settings, theme: 'neon' } })!.settings.theme).toBe('system');
    const { settings: _drop, ...noSettings } = save;
    expect(sanitize(noSettings)!.settings).toEqual({ sound: false, haptics: true, theme: 'system' });
  });
  it('puts every missed number into a review quiz', () => {
    const level = GROUPS[1].trial;
    const missed = pool(level).slice(0, 4);
    const qs = generateQuiz({ ...level, include: missed }, { dir: 'mixed', type: 'mixed', count: 8, rng: rng(7) });
    for (const n of missed) expect(qs.some((q) => q.n === n)).toBe(true);
  });
});

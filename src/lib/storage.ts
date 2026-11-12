// All persistence is one versioned localStorage key. No key = brand new user.

export const STORAGE_KEY = 'ludus.save.v1';

export interface Passed {
  laurels: number;
  best: number;
  at: string;
  /** True when credit came from passing a later trial rather than playing it. */
  testedOut?: boolean;
}

export interface HistoryEntry {
  at: string;
  kind: 'lesson' | 'trial' | 'practice' | 'weak' | 'speed';
  label: string;
  correct: number;
  total: number;
  ms: number;
  passed?: boolean;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Save {
  v: 1;
  xp: number;
  totalCorrect: number;
  lessons: Record<string, Passed>;
  trials: Record<string, Passed>;
  history: HistoryEntry[];
  tokenStats: Record<string, { seen: number; wrong: number }>;
  streak: { count: number; best: number; last: string };
  achievements: Record<string, string>;
  speedBest: Record<string, number>;
  settings: { sound: boolean; haptics: boolean; theme: Theme };
}

export function freshSave(): Save {
  return {
    v: 1,
    xp: 0,
    totalCorrect: 0,
    lessons: {},
    trials: {},
    history: [],
    tokenStats: {},
    streak: { count: 0, best: 0, last: '' },
    achievements: {},
    speedBest: {},
    settings: { sound: false, haptics: true, theme: 'system' },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);

/** Turn untrusted JSON (old save, imported file) into a usable Save, or null. */
export function sanitize(raw: unknown): Save | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const base = freshSave();
  const passedMap = (v: unknown): Record<string, Passed> => {
    const out: Record<string, Passed> = {};
    if (isObj(v)) {
      for (const [k, p] of Object.entries(v)) {
        if (isObj(p)) out[k] = { laurels: Math.min(3, num(p.laurels)), best: num(p.best), at: String(p.at ?? ''), testedOut: p.testedOut === true || undefined };
      }
    }
    return out;
  };
  const numMap = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (isObj(v)) for (const [k, n] of Object.entries(v)) out[k] = num(n);
    return out;
  };
  const stats: Save['tokenStats'] = {};
  if (isObj(raw.tokenStats)) {
    for (const [k, s] of Object.entries(raw.tokenStats)) if (isObj(s)) stats[k] = { seen: num(s.seen), wrong: num(s.wrong) };
  }
  const ach: Record<string, string> = {};
  if (isObj(raw.achievements)) for (const [k, a] of Object.entries(raw.achievements)) ach[k] = String(a);
  const history: HistoryEntry[] = Array.isArray(raw.history)
    ? raw.history.filter(isObj).slice(0, 200).map((h) => ({
        at: String(h.at ?? ''),
        kind: (['lesson', 'trial', 'practice', 'weak', 'speed'] as const).find((k) => k === h.kind) ?? 'practice',
        label: String(h.label ?? ''),
        correct: num(h.correct),
        total: num(h.total),
        ms: num(h.ms),
        passed: typeof h.passed === 'boolean' ? h.passed : undefined,
      }))
    : [];
  const streak = isObj(raw.streak) ? raw.streak : {};
  const settings = isObj(raw.settings) ? raw.settings : {};
  return {
    v: 1,
    xp: num(raw.xp),
    totalCorrect: num(raw.totalCorrect),
    lessons: passedMap(raw.lessons),
    trials: passedMap(raw.trials),
    history,
    tokenStats: stats,
    streak: { count: num(streak.count), best: num(streak.best), last: typeof streak.last === 'string' ? streak.last : '' },
    achievements: ach,
    speedBest: numMap(raw.speedBest),
    settings: {
      sound: typeof settings.sound === 'boolean' ? settings.sound : base.settings.sound,
      haptics: typeof settings.haptics === 'boolean' ? settings.haptics : base.settings.haptics,
      theme: (['system', 'light', 'dark'] as const).find((t) => t === settings.theme) ?? base.settings.theme,
    },
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw)) ?? freshSave();
  } catch {
    // Unreadable or blocked storage: behave like a new user.
  }
  return freshSave();
}

export function persist(save: Save): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or unavailable; progress lasts for this visit only.
  }
}

function exportBlob(save: Save): { blob: Blob; name: string } {
  const blob = new Blob([JSON.stringify({ app: 'ludus', exportedAt: new Date().toISOString(), save }, null, 2)], {
    type: 'application/json',
  });
  return { blob, name: `ludus-progress-${new Date().toISOString().slice(0, 10)}.json` };
}

export function exportSave(save: Save): void {
  const { blob, name } = exportBlob(save);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Revoking straight away can cancel the download in Safari and Firefox.
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
}

/**
 * True where the system share sheet can take a file and is worth offering: phones
 * and tablets. Desktop browsers often report support but then open nothing or fail
 * quietly, and they already have a plain download, so the button stays hidden there.
 */
export function canShareSave(): boolean {
  try {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return false;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'failed';

/** Opens the share sheet with the progress file. */
export async function shareSave(save: Save): Promise<ShareResult> {
  const { blob, name } = exportBlob(save);
  try {
    await navigator.share({ files: [new File([blob], name, { type: 'application/json' })], title: 'Ludus progress' });
    return 'shared';
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

export function parseImport(text: string): Save | null {
  try {
    const data = JSON.parse(text);
    return sanitize(isObj(data) && isObj(data.save) ? data.save : data);
  } catch {
    return null;
  }
}

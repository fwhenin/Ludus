// Small helpers shared by the screens: a "leave this screen?" guard, a
// per-tab resume slot so a reload picks up mid-lesson or mid-quiz, and
// remembered practice settings.

/**
 * The focused screen (lesson or quiz) registers a guard. It returns a
 * confirmation message when leaving would lose work, or null when it is safe.
 */
export const leave: { guard: (() => string | null) | null } = { guard: null };

/** Asks the guard, and the user if needed. True when it is fine to leave. */
export function mayLeave(): boolean {
  const msg = leave.guard?.();
  if (!msg) return true;
  try {
    return window.confirm(msg);
  } catch {
    return true;
  }
}

const RESUME_KEY = 'ludus.resume';

/** Progress inside the current lesson or quiz, kept for this tab only. */
export function readResume<T>(id: string): T | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.id === id ? (data.state as T) : null;
  } catch {
    return null;
  }
}

export function writeResume(id: string, state: unknown): void {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ id, state }));
  } catch {
    // Storage blocked: a reload will simply start over.
  }
}

export function clearResume(id?: string): void {
  try {
    if (id) {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw && JSON.parse(raw)?.id !== id) return;
    }
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // Ignore.
  }
}

export const newRunId = () => Math.random().toString(36).slice(2, 10);

const PRACTICE_KEY = 'ludus.practice';

export interface PracticePrefs {
  mode: 'practice' | 'weak' | 'speed';
  levelKey: string;
  dir: 'r2a' | 'a2r' | 'mixed';
  type: 'mc' | 'fill' | 'mixed';
  count: number;
}

export function readPracticePrefs(): Partial<PracticePrefs> {
  try {
    const raw = JSON.parse(localStorage.getItem(PRACTICE_KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return {};
    const out: Partial<PracticePrefs> = {};
    if (['practice', 'weak', 'speed'].includes(raw.mode)) out.mode = raw.mode;
    if (typeof raw.levelKey === 'string') out.levelKey = raw.levelKey;
    if (['r2a', 'a2r', 'mixed'].includes(raw.dir)) out.dir = raw.dir;
    if (['mc', 'fill', 'mixed'].includes(raw.type)) out.type = raw.type;
    if ([5, 10, 20].includes(raw.count)) out.count = raw.count;
    return out;
  } catch {
    return {};
  }
}

export function writePracticePrefs(p: PracticePrefs): void {
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(p));
  } catch {
    // Not important enough to report.
  }
}

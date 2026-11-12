import { useEffect, useRef, useState } from 'react';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { Practice } from './components/Practice';
import { Profile } from './components/Profile';
import { Quiz, QuizConfig } from './components/Quiz';
import { Group, Lesson, findLesson } from './lib/curriculum';
import { fxSettings } from './lib/fx';
import { QuizResult, applyResult, currentStreak, lessonUnlocked, rankFor, weakWeights } from './lib/game';
import { clearResume, leave, mayLeave, newRunId } from './lib/nav';
import { Save, Theme, loadSave, persist } from './lib/storage';

type Tab = 'home' | 'practice' | 'profile';
type View = { name: Tab } | { name: 'lesson'; lessonId: string } | { name: 'quiz'; config: QuizConfig; back: Tab };

interface NavState {
  view: View;
  /** How many app screens sit behind this one in the tab's history. */
  depth: number;
}

const TABS: Tab[] = ['home', 'practice', 'profile'];
const hashFor = (v: View) => (v.name === 'home' ? '#/' : v.name === 'lesson' ? `#/lesson/${v.lessonId}` : `#/${v.name}`);

function isView(v: unknown): v is View {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (TABS.includes(o.name as Tab)) return true;
  if (o.name === 'lesson') return typeof o.lessonId === 'string' && !!findLesson(o.lessonId);
  if (o.name === 'quiz') return typeof o.config === 'object' && o.config !== null && TABS.includes(o.back as Tab);
  return false;
}

/** The screen to show for the current history entry, falling back to the URL hash. */
function viewFromLocation(save: Save): View {
  const st = window.history.state as Partial<NavState> | null;
  let v: View = { name: 'home' };
  if (st && isView(st.view)) v = st.view;
  else {
    const h = window.location.hash.replace(/^#\/?/, '');
    if (h === 'practice' || h === 'profile') v = { name: h };
    else if (h.startsWith('lesson/')) v = { name: 'lesson', lessonId: h.slice(7) };
  }
  if (v.name === 'lesson') {
    const l = findLesson(v.lessonId);
    if (!l || !lessonUnlocked(save, l)) return { name: 'home' };
  }
  return v;
}

const navState = (): NavState | null => {
  const st = window.history.state as NavState | null;
  return st && isView(st.view) ? st : null;
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (theme === 'system') {
      m.setAttribute('content', m.getAttribute('data-default') ?? bg);
    } else m.setAttribute('content', bg);
  });
}

export default function App() {
  const [save, setSaveState] = useState<Save>(loadSave);
  const [view, setViewState] = useState<View>(() => viewFromLocation(save));
  const saveRef = useRef(save);

  const setSave = (s: Save) => {
    saveRef.current = s;
    setSaveState(s);
  };

  const current = useRef<NavState>({ view, depth: navState()?.depth ?? 0 });
  const skipGuard = useRef(false);

  // Make sure the first history entry carries our state so Back works from here on.
  useEffect(() => {
    const st = navState();
    window.history.replaceState({ view, depth: st?.depth ?? 0 } satisfies NavState, '', hashFor(view));
    const onPop = (e: PopStateEvent) => {
      const next = e.state as NavState | null;
      if (skipGuard.current) skipGuard.current = false;
      else if (!mayLeave()) {
        // Put back the entry we just left, so the screen and the URL agree.
        window.history.pushState(current.current, '', hashFor(current.current.view));
        return;
      }
      const v = next && isView(next.view) ? next.view : viewFromLocation(saveRef.current);
      current.current = { view: v, depth: next?.depth ?? 0 };
      setViewState(v);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  /** Go to a screen. `force` skips the leave-guard (the screen itself asked to move on). */
  const go = (v: View, opts: { replace?: boolean; force?: boolean } = {}) => {
    if (!opts.force && !mayLeave()) return;
    const depth = opts.replace ? current.current.depth : current.current.depth + 1;
    const st: NavState = { view: v, depth };
    if (opts.replace) window.history.replaceState(st, '', hashFor(v));
    else window.history.pushState(st, '', hashFor(v));
    current.current = st;
    setViewState(v);
  };

  /** Leave a lesson or quiz: step back in history when we came from inside the app. */
  const exit = (to: Tab) => {
    if (!mayLeave()) return;
    leave.guard = null;
    if (current.current.depth > 0) {
      skipGuard.current = true;
      window.history.back();
    } else go({ name: to }, { replace: true, force: true });
  };

  useEffect(() => {
    persist(save);
    fxSettings.sound = save.settings.sound;
    fxSettings.haptics = save.settings.haptics;
  }, [save]);

  useEffect(() => applyTheme(save.settings.theme), [save.settings.theme]);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    window.scrollTo(0, 0);
    if (view.name !== 'lesson' && view.name !== 'quiz') clearResume();
  }, [view]);

  const apply = (r: QuizResult) => {
    const { save: next, summary } = applyResult(saveRef.current, r);
    setSave(next);
    return summary;
  };

  const lessonQuiz = (l: Lesson): View => ({
    name: 'quiz',
    back: 'home',
    config: { kind: 'lesson', refId: l.id, runId: newRunId(), title: l.title, level: l.level, opts: { dir: 'mixed', type: 'mixed', count: 5 } },
  });
  const trialQuiz = (g: Group): View => ({
    name: 'quiz',
    back: 'home',
    config: { kind: 'trial', refId: g.id, runId: newRunId(), title: `Trial of Ludus ${g.num}`, level: g.trial, opts: { dir: 'mixed', type: 'mixed', count: 12 } },
  });

  const rank = rankFor(save.xp);
  const streak = currentStreak(save);
  const focused = view.name === 'lesson' || view.name === 'quiz';
  const lesson = view.name === 'lesson' ? findLesson(view.lessonId) : undefined;
  // Weights are functions, so they never go into history; rebuild them from the save.
  const quizConfig =
    view.name === 'quiz' && view.config.kind === 'weak'
      ? { ...view.config, opts: { ...view.config.opts, weights: weakWeights(save) ?? undefined } }
      : view.name === 'quiz'
        ? view.config
        : null;

  return (
    <div className="app">
      <header className={`topbar${focused ? ' focused' : ''}`}>
        <button
          type="button"
          className="logo"
          onClick={() => (view.name === 'quiz' ? exit(view.back) : focused ? exit('home') : go({ name: 'home' }))}
          aria-label="Ludus home"
        >
          LVDVS
        </button>
        {!focused && (
          <nav>
            {TABS.map((n) => (
              <button
                key={n}
                type="button"
                className={view.name === n ? 'on' : ''}
                aria-current={view.name === n ? 'page' : undefined}
                onClick={() => view.name !== n && go({ name: n })}
              >
                {n === 'home' ? 'Learn' : n === 'practice' ? 'Practice' : 'Profile'}
              </button>
            ))}
          </nav>
        )}
        <div className="status">
          {streak > 0 && <span title="Day streak">🔥 {streak}</span>}
          <span title={`${rank.name} · ${save.xp} XP`} className="rank-chip">
            <span className="rank-name">{rank.name} · </span>
            {save.xp} XP
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={save.settings.sound}
            aria-label={save.settings.sound ? 'Mute sound' : 'Turn sound on'}
            onClick={() => setSave({ ...save, settings: { ...save.settings, sound: !save.settings.sound } })}
          >
            {save.settings.sound ? '🔊' : '🔇'}
          </button>
        </div>
      </header>

      <main>
        {view.name === 'home' && (
          <Home save={save} onLesson={(l) => go({ name: 'lesson', lessonId: l.id })} onTrial={(g) => go(trialQuiz(g))} />
        )}
        {view.name === 'practice' && <Practice save={save} onStart={(config) => go({ name: 'quiz', config, back: 'practice' })} />}
        {view.name === 'profile' && <Profile save={save} setSave={setSave} />}
        {lesson && (
          <LessonPlayer
            key={lesson.id}
            lesson={lesson}
            onQuiz={() => go(lessonQuiz(lesson), { replace: true, force: true })}
            onExit={() => exit('home')}
          />
        )}
        {view.name === 'quiz' && quizConfig && (
          <Quiz
            key={quizConfig.runId}
            config={quizConfig}
            onApply={apply}
            onExit={() => exit(view.back)}
            onPractice={(config) => go({ name: 'quiz', config, back: view.back }, { replace: true, force: true })}
          />
        )}
      </main>

      <footer className="site-foot">Ludus: Latin for both "school" and "game". Your progress lives only in this browser.</footer>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { Practice } from './components/Practice';
import { Profile } from './components/Profile';
import { Quiz, QuizConfig } from './components/Quiz';
import { Group, Lesson } from './lib/curriculum';
import { fxSettings } from './lib/fx';
import { QuizResult, applyResult, currentStreak, rankFor } from './lib/game';
import { Save, loadSave, persist } from './lib/storage';

type View =
  | { name: 'home' | 'practice' | 'profile' }
  | { name: 'lesson'; lesson: Lesson }
  | { name: 'quiz'; config: QuizConfig; back: 'home' | 'practice' };

export default function App() {
  const [save, setSaveState] = useState<Save>(loadSave);
  const [view, setView] = useState<View>({ name: 'home' });
  const saveRef = useRef(save);

  const setSave = (s: Save) => {
    saveRef.current = s;
    setSaveState(s);
  };

  useEffect(() => {
    persist(save);
    fxSettings.sound = save.settings.sound;
    fxSettings.haptics = save.settings.haptics;
  }, [save]);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    window.scrollTo(0, 0);
  }, [view]);

  const apply = (r: QuizResult) => {
    const { save: next, summary } = applyResult(saveRef.current, r);
    setSave(next);
    return summary;
  };

  const lessonQuiz = (l: Lesson): View => ({
    name: 'quiz',
    back: 'home',
    config: { kind: 'lesson', refId: l.id, title: l.title, level: l.level, opts: { dir: 'mixed', type: 'mixed', count: 5 } },
  });
  const trialQuiz = (g: Group): View => ({
    name: 'quiz',
    back: 'home',
    config: { kind: 'trial', refId: g.id, title: `Trial of Ludus ${g.num}`, level: g.trial, opts: { dir: 'mixed', type: 'mixed', count: 12 } },
  });

  const rank = rankFor(save.xp);
  const streak = currentStreak(save);
  const focused = view.name === 'lesson' || view.name === 'quiz';

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="logo" onClick={() => setView({ name: 'home' })} aria-label="Ludus home">
          LVDVS
        </button>
        {!focused && (
          <nav>
            {(['home', 'practice', 'profile'] as const).map((n) => (
              <button key={n} type="button" className={view.name === n ? 'on' : ''} onClick={() => setView({ name: n })}>
                {n === 'home' ? 'Learn' : n === 'practice' ? 'Practice' : 'Profile'}
              </button>
            ))}
          </nav>
        )}
        <div className="status">
          {streak > 0 && <span title="Day streak">🔥 {streak}</span>}
          <span title={`${save.xp} XP`} className="rank-chip">
            {rank.name} · {save.xp} XP
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
          <Home save={save} onLesson={(lesson) => setView({ name: 'lesson', lesson })} onTrial={(g) => setView(trialQuiz(g))} />
        )}
        {view.name === 'practice' && <Practice save={save} onStart={(config) => setView({ name: 'quiz', config, back: 'practice' })} />}
        {view.name === 'profile' && <Profile save={save} setSave={setSave} />}
        {view.name === 'lesson' && (
          <LessonPlayer key={view.lesson.id} lesson={view.lesson} onQuiz={() => setView(lessonQuiz(view.lesson))} onExit={() => setView({ name: 'home' })} />
        )}
        {view.name === 'quiz' && <Quiz config={view.config} onApply={apply} onExit={() => setView({ name: view.back })} />}
      </main>

      <footer className="site-foot">Ludus: Latin for both "school" and "game". Your progress lives only in this browser.</footer>
    </div>
  );
}

import { GROUPS, Group, Lesson } from '../lib/curriculum';
import { groupPassed, groupUnlocked, lessonUnlocked, nextUp } from '../lib/game';
import type { Save } from '../lib/storage';
import { Laurels } from './shared';

interface Props {
  save: Save;
  onLesson: (l: Lesson) => void;
  onTrial: (g: Group) => void;
}

export function Home({ save, onLesson, onTrial }: Props) {
  const up = nextUp(save);
  const isNew = save.history.length === 0;
  return (
    <div className="home">
      <section className="hero card">
        <div>
          <h1>{isNew ? 'Salve! Welcome to Ludus.' : up ? 'Welcome back.' : 'Ave, Imperator!'}</h1>
          <p>
            {isNew
              ? 'Learn to read and write Roman numerals, one small idea at a time. Already know a bit? Take any trial to skip ahead.'
              : up
                ? 'Pick up where you left off, or replay a lesson for more laurels.'
                : 'You have passed every trial. Keep sharp with practice and speed rounds.'}
          </p>
        </div>
        {up?.lesson && (
          <button type="button" className="btn primary" onClick={() => onLesson(up.lesson!)}>
            {isNew ? 'Start lesson I →' : `Continue: ${up.lesson.title} →`}
          </button>
        )}
        {up?.trial && (
          <button type="button" className="btn primary" onClick={() => onTrial(up.trial!)}>
            Take the Ludus {up.trial.num} trial →
          </button>
        )}
      </section>

      {GROUPS.map((g) => {
        const open = groupUnlocked(save, g);
        const passed = groupPassed(save, g.id);
        const trial = save.trials[g.id];
        return (
          <section key={g.id} className={`group card${open ? '' : ' locked'}${passed ? ' passed' : ''}`}>
            <header>
              <span className="group-num">{g.num}</span>
              <div>
                <h2>{g.title}</h2>
                <p>{g.blurb}</p>
              </div>
              {!open && <span className="lock" aria-label="Locked">🔒</span>}
            </header>
            <ol className="lessons">
              {g.lessons.map((l) => {
                const p = save.lessons[l.id];
                const unlocked = lessonUnlocked(save, l);
                const current = up?.lesson?.id === l.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`lesson${p ? ' done' : ''}${current ? ' current' : ''}`}
                      disabled={!unlocked}
                      onClick={() => onLesson(l)}
                      aria-label={`${l.title}${unlocked ? '' : ' (locked)'}`}
                    >
                      <span className="medallion">{unlocked ? l.glyph : '🔒'}</span>
                      <span className="lesson-title">{l.title}</span>
                      <span className="lesson-sub">{p ? p.testedOut && !p.laurels ? 'Skipped ✓' : <Laurels count={p.laurels} /> : l.subtitle}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="trial-row">
              <div>
                <b>Trial of Ludus {g.num}</b>
                <span>
                  {passed
                    ? trial?.testedOut && !trial.laurels
                      ? 'Passed by a later trial'
                      : 'Passed'
                    : open
                      ? '12 questions · 80% to pass'
                      : 'Know this already? Pass to unlock everything up to here.'}
                </span>
              </div>
              {passed && !!trial?.laurels && <Laurels count={trial.laurels} />}
              <button type="button" className={`btn ${passed ? 'ghost' : 'secondary'}`} onClick={() => onTrial(g)}>
                {passed ? 'Retake' : open ? 'Take trial' : 'Test out'}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

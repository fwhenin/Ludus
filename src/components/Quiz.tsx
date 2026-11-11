import { useEffect, useRef, useState } from 'react';
import { buzz, celebrate, play } from '../lib/fx';
import { ACHIEVEMENTS, Answer, PASS_MARK, QuizResult, SPEED_SECONDS, Summary } from '../lib/game';
import { Level, QuizOptions, generateQuiz } from '../lib/generator';
import { SYMBOL_VALUE, looseValue, symbolsFor } from '../lib/roman';
import { Breakdown, DIGITS, Laurels, Numeral, Pad } from './shared';

export interface QuizConfig {
  kind: QuizResult['kind'];
  refId: string;
  title: string;
  level: Level;
  opts: QuizOptions;
}

interface Props {
  config: QuizConfig;
  onApply: (r: QuizResult) => Summary;
  onExit: () => void;
}

export function Quiz(props: Props) {
  const [round, setRound] = useState(0);
  return <Round key={round} {...props} onRetry={() => setRound((r) => r + 1)} />;
}

function Round({ config, onApply, onExit, onRetry }: Props & { onRetry: () => void }) {
  const speed = config.kind === 'speed';
  const [qs] = useState(() => generateQuiz(config.level, { ...config.opts, count: speed ? 90 : config.opts.count }));
  const [i, setI] = useState(0);
  const [input, setInput] = useState('');
  const [fb, setFb] = useState<{ correct: boolean; given: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [left, setLeft] = useState(SPEED_SECONDS);
  const answers = useRef<Answer[]>([]);
  const started = useRef(Date.now());
  const finished = useRef(false);
  const q = qs[i];
  const symbols = symbolsFor(config.level.tokens);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const s = onApply({
      kind: config.kind,
      ref: config.refId,
      label: config.title,
      answers: answers.current,
      ms: Date.now() - started.current,
    });
    setSummary(s);
    const happy = speed ? !!s.personalBest : config.kind === 'lesson' || config.kind === 'trial' ? s.passed : s.correct / Math.max(1, s.total) >= PASS_MARK;
    if (happy) {
      play('win');
      buzz([20, 60, 20, 60, 60]);
      celebrate();
    } else if (config.kind === 'lesson' || config.kind === 'trial') {
      play('fail');
    }
  };

  const next = () => {
    if (finished.current) return;
    setFb(null);
    setInput('');
    if (i + 1 >= qs.length) finish();
    else setI(i + 1);
  };

  const submit = (given: string) => {
    if (fb || finished.current || !given) return;
    const correct = given === q.answer;
    answers.current.push({ n: q.n, dir: q.dir, type: q.type, correct });
    setFb({ correct, given });
    play(correct ? 'good' : 'bad');
    buzz(correct ? 15 : [40, 50, 40]);
    if (speed) setTimeout(() => latest.current.next(), correct ? 350 : 1300);
  };

  const typeKey = (k: string) => !fb && setInput((v) => (v + k).slice(0, q.dir === 'a2r' ? 16 : 4));
  const back = () => !fb && setInput((v) => v.slice(0, -1));
  const clean = (v: string) => (q.dir === 'r2a' ? String(parseInt(v, 10)) : v);

  // Timers and key listeners must always see the current closures.
  const latest = useRef({ next, finish });
  latest.current = { next, finish };

  useEffect(() => {
    if (!speed) return;
    const t = setInterval(() => {
      const remaining = SPEED_SECONDS - (Date.now() - started.current) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) latest.current.finish();
    }, 200);
    return () => clearInterval(t);
  }, [speed]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (summary || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (fb) {
          if (!speed) next();
        } else if (q.type === 'fill' && input) submit(clean(input));
        return;
      }
      if (fb) return;
      if (q.type === 'mc') {
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx >= 0 && q.options![idx]) submit(q.options![idx]);
      } else if (e.key === 'Backspace') back();
      else if (q.dir === 'a2r' && SYMBOL_VALUE[e.key.toUpperCase()]) typeKey(e.key.toUpperCase());
      else if (q.dir === 'r2a' && /^\d$/.test(e.key)) typeKey(e.key);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (summary) return <Results config={config} summary={summary} onExit={onExit} onRetry={onRetry} />;

  const score = answers.current.filter((a) => a.correct).length;
  const nearMiss = fb && !fb.correct && q.dir === 'a2r' && looseValue(fb.given) === q.n;

  return (
    <section className="stage">
      <header className="stage-head">
        <button type="button" className="link" onClick={onExit}>
          ← Quit
        </button>
        {speed ? (
          <div className={`progress timer${left < 10 ? ' low' : ''}`}>
            <div style={{ width: `${(left / SPEED_SECONDS) * 100}%` }} />
          </div>
        ) : (
          <div className="progress">
            <div style={{ width: `${((i + (fb ? 1 : 0)) / qs.length) * 100}%` }} />
          </div>
        )}
        <span className="count">{speed ? `${Math.ceil(left)}s · ${score} ✓` : `${i + 1}/${qs.length}`}</span>
      </header>

      <article className={`card quiz-card${fb ? (fb.correct ? ' is-right' : ' is-wrong') : ''}`} key={i}>
        <p className="eyebrow">{q.dir === 'r2a' ? 'What number is this?' : 'Write this in Roman numerals'}</p>
        {q.dir === 'r2a' ? <Numeral value={q.prompt} /> : <div className="target big">{q.prompt}</div>}

        {q.type === 'mc' ? (
          <div className="options">
            {q.options!.map((o, k) => (
              <button
                key={o}
                type="button"
                className={`option${q.dir === 'a2r' ? ' roman' : ''}${fb ? (o === q.answer ? ' right' : o === fb.given ? ' wrong' : '') : ''}`}
                disabled={!!fb}
                onClick={() => submit(o)}
              >
                <kbd>{k + 1}</kbd>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={`slate${q.dir === 'r2a' ? ' digits' : ''} ${fb ? (fb.correct ? 'right' : 'wrong') : 'idle'}`}>
              {input || <span className="placeholder">{q.dir === 'a2r' ? 'tap the tiles' : 'type the number'}</span>}
            </div>
            <Pad keys={q.dir === 'a2r' ? symbols : DIGITS} onKey={typeKey} onBack={back} disabled={!!fb} />
          </>
        )}

        <div className="feedback" aria-live="polite">
          {fb && (
            <>
              <p className="verdict">
                {fb.correct ? pick(PRAISE, i) : nearMiss ? 'So close!' : 'Not quite.'}
                {!fb.correct && (
                  <>
                    {' '}
                    The answer is <b>{q.answer}</b>.
                  </>
                )}
              </p>
              {nearMiss && <p className="hint">{fb.given} adds up to {q.n}, but the standard form uses the subtraction trick.</p>}
              {!speed && <Breakdown n={q.n} />}
            </>
          )}
        </div>
      </article>

      <footer className="stage-foot">
        {!fb && q.type === 'fill' && (
          <button type="button" className="btn primary" disabled={!input} onClick={() => submit(clean(input))}>
            Check
          </button>
        )}
        {fb && !speed && (
          <button type="button" className="btn primary" onClick={next} autoFocus>
            {i + 1 >= qs.length ? 'See results →' : 'Next →'}
          </button>
        )}
      </footer>
    </section>
  );
}

const PRAISE = ['Optime!', 'Correct!', 'Bene!', 'Spot on!', 'Recte!', 'Nicely done!'];
const pick = (list: string[], i: number) => list[i % list.length];

function Results({ config, summary: s, onExit, onRetry }: { config: QuizConfig; summary: Summary; onExit: () => void; onRetry: () => void }) {
  const graded = config.kind === 'lesson' || config.kind === 'trial';
  const speed = config.kind === 'speed';
  const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  const heading = speed
    ? s.personalBest
      ? 'New personal best!'
      : 'Time!'
    : graded
      ? s.passed
        ? config.kind === 'trial'
          ? 'Trial passed!'
          : 'Lesson complete!'
        : 'Not this time'
      : pct >= 80
        ? 'Strong practice!'
        : 'Practice complete';
  return (
    <section className="stage">
      <article className="card results">
        <p className="eyebrow">{config.title}</p>
        <h2>{heading}</h2>
        {graded && <Laurels count={s.laurels} big />}
        <div className="score">
          <span className="big-num">{speed ? s.correct : `${s.correct}/${s.total}`}</span>
          <span>{speed ? `correct in ${SPEED_SECONDS} seconds` : `${pct}% correct`}</span>
        </div>
        {speed && !s.personalBest && !!s.previousBest && <p className="hint">Your best is {s.previousBest}.</p>}
        {speed && s.total > s.correct && <p className="hint">{s.total - s.correct} missed.</p>}
        {graded && !s.passed && (
          <p className="hint">You need {Math.round(PASS_MARK * 100)}% to pass. Every miss shows you what to review, so have another go.</p>
        )}
        <ul className="rewards">
          {s.xp > 0 && (
            <li className="xp">
              +{s.xp} XP
              {!!s.skippedXp && <small>includes {s.skippedXp} XP for everything you tested out of</small>}
            </li>
          )}
          {s.rankUp && <li className="rank">Promoted to {s.rankUp}!</li>}
          {s.unlocked && <li className="unlock">Unlocked {s.unlocked}</li>}
          {s.newAchievements.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id)!;
            return (
              <li key={id} className="ach">
                {a.icon} {a.name}
                <small>{a.desc}</small>
              </li>
            );
          })}
        </ul>
      </article>
      <footer className="stage-foot">
        <button type="button" className="btn ghost" onClick={onRetry}>
          {graded && s.passed && s.laurels < 3 ? 'Go for more laurels' : 'Try again'}
        </button>
        <button type="button" className="btn primary" onClick={onExit}>
          Continue →
        </button>
      </footer>
    </section>
  );
}

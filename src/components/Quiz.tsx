import { useEffect, useRef, useState } from 'react';
import { buzz, celebrate, play } from '../lib/fx';
import { ACHIEVEMENTS, Answer, PASS_MARK, QuizResult, SPEED_SECONDS, Summary } from '../lib/game';
import { Level, Question, QuizOptions, generateQuiz } from '../lib/generator';
import { clearResume, leave, newRunId, readResume, writeResume } from '../lib/nav';
import { SYMBOL_VALUE, looseValue, symbolsFor, toRoman } from '../lib/roman';
import { Breakdown, DIGITS, Laurels, Numeral, Pad } from './shared';

export interface QuizConfig {
  kind: QuizResult['kind'];
  refId: string;
  /** Identifies this run, so a reload can resume it. */
  runId: string;
  title: string;
  level: Level;
  opts: QuizOptions;
}

interface Props {
  config: QuizConfig;
  onApply: (r: QuizResult) => Summary;
  onExit: () => void;
  /** Start a follow-up practice quiz (e.g. on the questions just missed). */
  onPractice: (c: QuizConfig) => void;
}

interface Saved {
  round: number;
  qs: Question[];
  answers: Answer[];
  elapsed: number;
}

export function Quiz(props: Props) {
  const [round, setRound] = useState(() => readResume<Saved>(props.config.runId)?.round ?? 0);
  return <Round key={round} round={round} {...props} onRetry={() => setRound((r) => r + 1)} />;
}

function Round({ config, onApply, onExit, onPractice, onRetry, round }: Props & { onRetry: () => void; round: number }) {
  const speed = config.kind === 'speed';
  // Speed rounds are about the clock, so a reload starts a fresh one.
  const [saved] = useState(() => {
    const s = speed ? null : readResume<Saved>(config.runId);
    return s && s.round === round && Array.isArray(s.qs) && s.qs.length > 0 ? s : null;
  });
  const [qs] = useState(() => saved?.qs ?? generateQuiz(config.level, { ...config.opts, count: speed ? 90 : config.opts.count }));
  const [i, setI] = useState(() => Math.min(saved?.answers.length ?? 0, qs.length - 1));
  const [input, setInput] = useState('');
  const [fb, setFb] = useState<{ correct: boolean; given: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [left, setLeft] = useState(SPEED_SECONDS);
  const [paused, setPaused] = useState(false);
  const answers = useRef<Answer[]>(saved?.answers ?? []);
  const started = useRef(Date.now() - (saved?.elapsed ?? 0));
  const pausedAt = useRef(0);
  const finished = useRef(false);
  const q = qs[i];
  const symbols = symbolsFor(config.level.tokens);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    clearResume(config.runId);
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
    answers.current.push({ n: q.n, dir: q.dir, type: q.type, correct, given });
    setFb({ correct, given });
    play(correct ? 'good' : 'bad');
    buzz(correct ? 15 : [40, 50, 40]);
    if (speed) setTimeout(() => latest.current.next(), correct ? 350 : 1300);
    else writeResume(config.runId, { round, qs, answers: answers.current, elapsed: Date.now() - started.current } satisfies Saved);
  };

  const typeKey = (k: string) => !fb && setInput((v) => (v + k).slice(0, q.dir === 'a2r' ? 16 : 4));
  const back = () => !fb && setInput((v) => v.slice(0, -1));
  const clean = (v: string) => (q.dir === 'r2a' ? String(parseInt(v, 10)) : v);

  // Timers and key listeners must always see the current closures.
  const latest = useRef({ next, finish });
  latest.current = { next, finish };

  // A reload after the last answer but before the results: finish straight away.
  useEffect(() => {
    if (saved && saved.answers.length >= qs.length) latest.current.finish();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving part-way through loses the answers, so ask first.
  useEffect(() => {
    leave.guard = () =>
      !finished.current && answers.current.length > 0
        ? config.kind === 'trial' || config.kind === 'lesson'
          ? 'Leave this quiz? Your answers so far will be lost.'
          : 'Leave this practice? Your answers so far will not be counted.'
        : null;
    return () => {
      leave.guard = null;
    };
  }, [config.kind]);

  // Pause the speed round while the page is hidden (app switch, notification, locked screen).
  useEffect(() => {
    if (!speed) return;
    const onVis = () => {
      if (document.hidden && !finished.current && !pausedAt.current) {
        pausedAt.current = Date.now();
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [speed]);

  const resume = () => {
    if (!pausedAt.current) return;
    started.current += Date.now() - pausedAt.current;
    pausedAt.current = 0;
    setPaused(false);
  };

  useEffect(() => {
    if (!speed) return;
    const t = setInterval(() => {
      if (pausedAt.current) return;
      const remaining = SPEED_SECONDS - (Date.now() - started.current) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) latest.current.finish();
    }, 200);
    return () => clearInterval(t);
  }, [speed]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (summary || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
        return;
      }
      if (paused) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resume();
        }
        return;
      }
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

  if (summary) {
    return <Results config={config} summary={summary} misses={answers.current.filter((a) => !a.correct)} onExit={onExit} onRetry={onRetry} onPractice={onPractice} />;
  }

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
          <div className="progress" role="progressbar" aria-label="Quiz progress" aria-valuenow={i + (fb ? 1 : 0)} aria-valuemax={qs.length}>
            <div style={{ width: `${((i + (fb ? 1 : 0)) / qs.length) * 100}%` }} />
          </div>
        )}
        <span className="count">{speed ? `${Math.ceil(left)}s · ${score} ✓` : `${i + 1}/${qs.length}`}</span>
      </header>

      {paused ? (
        <article className="card quiz-card paused">
          <p className="eyebrow">Paused</p>
          <h2>The sand has stopped</h2>
          <p className="hint">The clock paused while you were away. {Math.ceil(left)} seconds left.</p>
          <button type="button" className="btn primary" onClick={resume} autoFocus>
            Resume →
          </button>
        </article>
      ) : (
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
      )}

      <footer className="stage-foot">
        {!paused && !fb && q.type === 'fill' && (
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

interface ResultsProps {
  config: QuizConfig;
  summary: Summary;
  misses: Answer[];
  onExit: () => void;
  onRetry: () => void;
  onPractice: (c: QuizConfig) => void;
}

function Results({ config, summary: s, misses, onExit, onRetry, onPractice }: ResultsProps) {
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
        {misses.length > 0 && (
          <div className="misses">
            <h3>Worth another look</h3>
            <ul>
              {misses.slice(0, 12).map((a, k) => (
                <li key={k}>
                  <span className="miss-q">{a.dir === 'r2a' ? `${toRoman(a.n)} = ?` : `${a.n} = ?`}</span>
                  <span className="miss-a">
                    <b>{a.dir === 'r2a' ? a.n : toRoman(a.n)}</b>
                    {a.given !== undefined && a.given !== 'NaN' && <small>you said {a.given}</small>}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn secondary wide" onClick={() => onPractice(reviewConfig(config, misses))}>
              Practise these →
            </button>
          </div>
        )}
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

/** A short practice quiz that makes sure every missed number comes up again. */
function reviewConfig(config: QuizConfig, misses: Answer[]): QuizConfig {
  const nums = [...new Set(misses.map((a) => a.n))].slice(0, 10);
  return {
    kind: 'practice',
    refId: config.refId,
    runId: newRunId(),
    title: `Review · ${config.title.replace(/^Review · /, '')}`,
    level: { ...config.level, include: nums },
    opts: { dir: 'mixed', type: 'mixed', count: Math.min(10, Math.max(5, nums.length * 2)) },
  };
}

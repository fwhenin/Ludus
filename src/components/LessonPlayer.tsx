import { Fragment, useEffect, useRef, useState } from 'react';
import type { Card, Lesson } from '../lib/curriculum';
import { buzz, play } from '../lib/fx';
import { clearResume, leave, readResume, writeResume } from '../lib/nav';
import { looseValue, parts, symbolsFor, toRoman, tokenize, working, SYMBOL_VALUE } from '../lib/roman';
import { Numeral, Pad } from './shared';

/**
 * What Enter (and, if `label` is set, the footer's main button) does on a
 * card that is not finished yet.
 */
interface Action {
  run: () => void;
  label?: string;
  disabled?: boolean;
}

interface CardProps<C> {
  card: C;
  symbols: string[];
  onDone: () => void;
  setAction: (a: Action | null) => void;
}

/** Registers the card's action and keeps it current. */
function useAction(setAction: (a: Action | null) => void, action: Action | null, deps: unknown[]) {
  useEffect(() => {
    setAction(action);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setAction(null), []); // eslint-disable-line react-hooks/exhaustive-deps
}

function TapCard({ card, onDone, setAction }: CardProps<Extract<Card, { t: 'tap' }>>) {
  const chunks = card.each
    ? tokenize(card.n).map((t) => ({ roman: t as string, value: looseValue(t)! }))
    : parts(card.n);
  const [shown, setShown] = useState<boolean[]>(() => chunks.map(() => false));
  const all = shown.every(Boolean);
  const sum = chunks.reduce((s, c, i) => s + (shown[i] ? c.value : 0), 0);
  useEffect(() => {
    if (all) onDone();
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Reveal one piece; with no index, the next hidden one. */
  const reveal = (i?: number) => {
    setShown((s) => {
      const k = i ?? s.indexOf(false);
      if (k < 0 || s[k]) return s;
      play('tap');
      buzz(10);
      return s.map((v, j) => v || j === k);
    });
  };
  // Enter reveals the next hidden piece.
  useAction(setAction, all ? null : { run: () => reveal() }, [all]);
  return (
    <>
      <p className="card-text">{card.text}</p>
      <div className="tap-row">
        {chunks.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`tap-chunk${shown[i] ? ' shown' : ''}`}
            onClick={() => reveal(i)}
          >
            <b>{c.roman}</b>
            <i>{shown[i] ? c.value : '?'}</i>
            {shown[i] && working(c.roman) && <small>{working(c.roman)}</small>}
          </button>
        ))}
      </div>
      <p className={`tap-sum${all ? ' done' : ''}`} aria-live="polite">
        {all ? `${chunks.map((c) => c.value).join(' + ')} = ${card.n}` : sum > 0 ? `${sum} so far…` : 'Tap a piece'}
      </p>
    </>
  );
}

function BuildCard({ card, symbols, onDone, setAction }: CardProps<Extract<Card, { t: 'build' }>>) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'wrong' | 'close' | 'right'>('idle');
  const target = toRoman(card.n);
  // Mirrors `value` synchronously, so fast typing followed by Enter checks what was typed.
  const valueRef = useRef('');
  const update = (next: string) => {
    valueRef.current = next;
    setValue(next);
  };
  const check = (v = valueRef.current) => {
    if (!v || state === 'right') return;
    if (v === target) {
      setState('right');
      play('good');
      buzz(15);
      onDone();
    } else {
      setState(looseValue(v) === card.n ? 'close' : 'wrong');
      play('bad');
      buzz([30, 40, 30]);
    }
  };
  const key = (k: string) => {
    if (state === 'right') return;
    setState('idle');
    update((valueRef.current + k).slice(0, 16));
  };
  const back = () => {
    if (state === 'right') return;
    setState('idle');
    update(valueRef.current.slice(0, -1));
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (SYMBOL_VALUE[k]) key(k);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  // The footer's main button doubles as Check, so there is only ever one button to press.
  useAction(setAction, state === 'right' ? null : { run: () => check(), label: 'Check', disabled: !value }, [value, state]);
  const running = looseValue(value);
  return (
    <>
      <p className="card-text">{card.text}</p>
      {card.wrong && (
        <div className="mistake">
          <Numeral value={card.wrong} small struck />
          <span>should be {card.n}</span>
        </div>
      )}
      {!card.wrong && <div className="target">{card.n}</div>}
      <div className={`slate ${state}`} aria-live="polite">
        {value || <span className="placeholder">tap the tiles</span>}
      </div>
      <p className="hint">
        {state === 'right' && `Perfect: ${target} = ${card.n}`}
        {state === 'close' && 'That adds up, but there is a shorter, standard way. Try the subtraction trick.'}
        {state === 'wrong' && (running !== null ? `That makes ${running}. Biggest symbols first!` : 'Not quite. Try again.')}
        {state === 'idle' && ' '}
      </p>
      <Pad keys={symbols} onKey={key} onBack={back} disabled={state === 'right'} />
    </>
  );
}

function PickCard({ card, onDone }: CardProps<Extract<Card, { t: 'pick' }>>) {
  const [tried, setTried] = useState<number[]>([]);
  const solved = tried.includes(card.answer);
  const choose = (i: number) => {
    if (solved || tried.includes(i)) return;
    setTried((t) => [...t, i]);
    if (i === card.answer) {
      play('good');
      buzz(15);
      onDone();
    } else {
      play('bad');
      buzz([30, 40, 30]);
    }
  };
  // Number keys pick an option, as in quizzes.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      if (idx >= 0 && idx < card.options.length) choose(idx);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <>
      <p className="card-text question">{card.q}</p>
      <div className="options">
        {card.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={`option${tried.includes(i) ? (i === card.answer ? ' right' : ' wrong') : ''}`}
            disabled={solved || tried.includes(i)}
            onClick={() => choose(i)}
          >
            <kbd>{i + 1}</kbd>
            {o}
          </button>
        ))}
      </div>
      <p className="hint" aria-live="polite">
        {solved ? card.why : tried.length ? 'Not that one. Have another go.' : ' '}
      </p>
    </>
  );
}

/** One tile per symbol with its value underneath, joined by the operation that links them. */
function Equation({ symbols, subtract }: { symbols: string[]; subtract: boolean }) {
  return (
    <div className={`equation ${subtract ? 'sub' : 'add'}`}>
      {symbols.map((sym, i) => (
        <Fragment key={i}>
          {i > 0 && !subtract && <span className="op">+</span>}
          <span className="eq-tile">
            <b>{sym}</b>
            <i>{subtract && i === 0 ? `− ${SYMBOL_VALUE[sym]}` : SYMBOL_VALUE[sym]}</i>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function RuleCard({ card }: { card: Extract<Card, { t: 'rule' }> }) {
  const symbols = card.numeral.split('');
  const subtract = symbols.length === 2 && SYMBOL_VALUE[symbols[0]] < SYMBOL_VALUE[symbols[1]];
  return (
    <>
      <h2>{card.title}</h2>
      <Equation symbols={symbols} subtract={subtract} />
      <p className={`eq-result ${subtract ? 'sub' : 'add'}`}>
        {working(card.numeral)} = {looseValue(card.numeral)}
      </p>
      <p className="card-text">{card.text}</p>
    </>
  );
}

function FlipCard({ card, onDone, setAction }: CardProps<Extract<Card, { t: 'flip' }>>) {
  const [smallFirst, setSmallFirst] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const numeral = smallFirst ? card.small + card.big : card.big + card.small;
  const swap = () => {
    play('tap');
    buzz(12);
    setSmallFirst((v) => !v);
    setSwapped(true);
    onDone();
  };
  useAction(setAction, swapped ? null : { run: swap }, [swapped]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) swap();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <>
      <p className="card-text">{card.text}</p>
      <div key={numeral} className="flip-stage">
        <Equation symbols={numeral.split('')} subtract={smallFirst} />
      </div>
      <p className={`eq-result ${smallFirst ? 'sub' : 'add'}`} aria-live="polite">
        {numeral}: {working(numeral)} = {looseValue(numeral)}
      </p>
      <p className="hint">
        {smallFirst ? `Smaller symbol BEFORE the bigger one: take it away.` : `Smaller symbol AFTER the bigger one: add it on.`}
      </p>
      <button type="button" className="btn secondary" onClick={swap}>
        ⇄ Swap the symbols
      </button>
      <p className="hint kbd-hint">Tip: press S to swap</p>
    </>
  );
}

export function LessonPlayer({ lesson, onQuiz, onExit }: { lesson: Lesson; onQuiz: () => void; onExit: () => void }) {
  const resumeId = `lesson:${lesson.id}`;
  const [i, setI] = useState(() => {
    const saved = readResume<{ i: number }>(resumeId);
    return saved && saved.i > 0 && saved.i < lesson.cards.length ? saved.i : 0;
  });
  const [done, setDone] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const card = lesson.cards[i];
  const symbols = symbolsFor(lesson.level.tokens);
  const passive = card.t === 'intro' || card.t === 'fact' || card.t === 'rule';
  const last = i === lesson.cards.length - 1;
  const canNext = passive || done;
  const next = () => {
    if (!canNext) return;
    if (last) {
      clearResume(resumeId);
      return onQuiz();
    }
    setDone(false);
    setI(i + 1);
  };
  const prev = () => {
    if (i === 0) return;
    setDone(true);
    setI(i - 1);
  };

  // Remember the card for this tab, so a reload carries on from here.
  useEffect(() => {
    writeResume(resumeId, { i });
  }, [resumeId, i]);

  useEffect(() => {
    leave.guard = () => (iRef.current > 0 ? 'Leave this lesson? Next time it will start from the beginning.' : null);
    return () => {
      leave.guard = null;
    };
  }, []);
  const iRef = useRef(i);
  iRef.current = i;

  // Enter moves on (or does the card's own step), Escape leaves, arrows page through.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (e.key === 'Enter') {
        // A keyboard user who tabbed to an answer or a piece picks it with Enter.
        if (t && t.tagName === 'BUTTON' && t.closest('.options, .tap-row')) return;
        e.preventDefault();
        // Each action guards itself, so call it even if the button looks disabled mid-update.
        if (!canNext && action) action.run();
        else next();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key === 'ArrowRight' && canNext) next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const props = { symbols, onDone: () => setDone(true), setAction };
  const footerAction = !canNext && action?.label ? action : null;
  return (
    <section className="stage">
      <header className="stage-head">
        <button type="button" className="link" onClick={onExit}>
          ← Map
        </button>
        <div className="progress" role="progressbar" aria-label="Lesson progress" aria-valuenow={i + 1} aria-valuemax={lesson.cards.length}>
          <div style={{ width: `${((i + (canNext ? 1 : 0)) / lesson.cards.length) * 100}%` }} />
        </div>
        <span className="count">
          {i + 1}/{lesson.cards.length}
        </span>
      </header>
      <article className={`card lesson-card t-${card.t}`} key={i}>
        {card.t === 'intro' && (
          <>
            <Numeral value={card.numeral} />
            <h2>{card.title}</h2>
            <p className="card-text">{card.text}</p>
          </>
        )}
        {card.t === 'fact' && (
          <>
            <div className="fact-icon">{card.icon}</div>
            <h2>{card.title}</h2>
            <p className="card-text">{card.text}</p>
          </>
        )}
        {card.t === 'rule' && <RuleCard card={card} />}
        {card.t === 'flip' && <FlipCard card={card} {...props} />}
        {card.t === 'tap' && <TapCard card={card} {...props} />}
        {card.t === 'build' && <BuildCard card={card} {...props} />}
        {card.t === 'pick' && <PickCard card={card} {...props} />}
      </article>
      <footer className="stage-foot">
        {i > 0 && (
          <button type="button" className="btn ghost" onClick={prev}>
            Back
          </button>
        )}
        {footerAction ? (
          <button type="button" className="btn primary" disabled={footerAction.disabled} onClick={footerAction.run}>
            {footerAction.label}
          </button>
        ) : (
          <button type="button" className="btn primary" disabled={!canNext} onClick={next}>
            {last ? 'Take the lesson quiz →' : 'Next →'}
          </button>
        )}
      </footer>
    </section>
  );
}

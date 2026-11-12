import { useEffect, useState } from 'react';
import { SPEED_SECONDS, practiceLevels, weakWeights } from '../lib/game';
import type { Dir, QType } from '../lib/generator';
import { newRunId, readPracticePrefs, writePracticePrefs } from '../lib/nav';
import type { Save } from '../lib/storage';
import type { QuizConfig } from './Quiz';

type Mode = 'practice' | 'weak' | 'speed';

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="seg">
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Practice({ save, onStart }: { save: Save; onStart: (c: QuizConfig) => void }) {
  const levels = practiceLevels(save);
  const weights = weakWeights(save);
  const [prefs] = useState(readPracticePrefs);
  const [mode, setMode] = useState<Mode>(prefs.mode ?? 'practice');
  const [levelKey, setLevelKey] = useState(
    prefs.levelKey && levels.some((l) => l.key === prefs.levelKey) ? prefs.levelKey : (levels[levels.length - 1]?.key ?? ''),
  );
  const [dir, setDir] = useState<Dir | 'mixed'>(prefs.dir ?? 'mixed');
  const [type, setType] = useState<QType | 'mixed'>(prefs.type ?? 'mixed');
  const [count, setCount] = useState(prefs.count ?? 10);

  useEffect(() => writePracticePrefs({ mode, levelKey, dir, type, count }), [mode, levelKey, dir, type, count]);

  if (levels.length === 0) {
    return (
      <section className="card panel">
        <h1>Practice</h1>
        <p>Pass your first lesson (or test out with a trial) to unlock free practice and speed rounds.</p>
      </section>
    );
  }

  const chosen = levels.find((l) => l.key === levelKey) ?? levels[levels.length - 1];
  const best = save.speedBest[chosen.key];
  const start = () => {
    const name = mode === 'speed' ? 'Speed round' : mode === 'weak' ? 'Weak spots' : 'Practice';
    onStart({
      kind: mode,
      refId: chosen.key,
      runId: newRunId(),
      title: `${name} · ${chosen.label}`,
      level: chosen.level,
      opts: { dir, type: mode === 'speed' && type === 'mixed' ? 'mc' : type, count },
    });
  };

  return (
    <section className="card panel">
      <h1>Practice</h1>
      <p>Fresh questions every time, drawn only from what you have learned.</p>
      <Choice<Mode>
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          ['practice', 'Free practice'],
          ['weak', 'Weak spots'],
          ['speed', `Speed round (${SPEED_SECONDS}s)`],
        ]}
      />
      {mode === 'weak' && (
        <p className="hint">{weights ? 'Extra helpings of the numerals you have missed most.' : 'No mistakes on record yet, so this will be an even mix.'}</p>
      )}
      {mode === 'speed' && (
        <p className="hint">
          Answer as many as you can before the sand runs out. {best ? `Personal best at this level: ${best}.` : 'No personal best at this level yet.'}
        </p>
      )}
      <fieldset className="choice">
        <legend>Level</legend>
        <select value={chosen.key} onChange={(e) => setLevelKey(e.target.value)}>
          {levels.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
      </fieldset>
      <Choice<Dir | 'mixed'>
        label="Direction"
        value={dir}
        onChange={setDir}
        options={[
          ['r2a', 'XIV → 14'],
          ['a2r', '14 → XIV'],
          ['mixed', 'Both'],
        ]}
      />
      <Choice<QType | 'mixed'>
        label="Answer style"
        value={mode === 'speed' && type === 'mixed' ? 'mc' : type}
        onChange={setType}
        options={mode === 'speed' ? [['mc', 'Multiple choice'], ['fill', 'Fill in']] : [['mc', 'Multiple choice'], ['fill', 'Fill in'], ['mixed', 'Both']]}
      />
      {mode !== 'speed' && (
        <Choice<number> label="Questions" value={count} onChange={setCount} options={[[5, '5'], [10, '10'], [20, '20']]} />
      )}
      <button type="button" className="btn primary wide" onClick={start}>
        Start →
      </button>
    </section>
  );
}

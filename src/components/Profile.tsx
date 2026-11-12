import { useRef, useState } from 'react';
import { hapticsSupported } from '../lib/fx';
import { ACHIEVEMENTS, RANKS, currentStreak, rankFor } from '../lib/game';
import { Save, Theme, canShareSave, exportSave, freshSave, parseImport, shareSave } from '../lib/storage';

export function Profile({ save, setSave }: { save: Save; setSave: (s: Save) => void }) {
  const rank = rankFor(save.xp);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const earned = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
  const setting = (key: 'sound' | 'haptics', value: boolean) => setSave({ ...save, settings: { ...save.settings, [key]: value } });
  const setTheme = (theme: Theme) => setSave({ ...save, settings: { ...save.settings, theme } });
  const [shareable] = useState(canShareSave);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    const next = parseImport(await f.text());
    if (!next) return setMsg('That file is not a Ludus progress file.');
    if (save.history.length && !window.confirm('Replace the progress in this browser with the imported file?')) return;
    setSave(next);
    setMsg('Progress imported.');
  };

  return (
    <div className="profile">
      <section className="card panel">
        <p className="eyebrow">Your rank</p>
        <h1>{rank.name}</h1>
        <p>{rank.note}</p>
        <div className="progress xpbar">
          <div style={{ width: `${rank.progress * 100}%` }} />
        </div>
        <p className="hint">
          {save.xp} XP{rank.next ? ` · ${rank.next.xp - save.xp} to ${rank.next.name}` : ' · top rank reached'}
        </p>
        <ol className="ranks">
          {RANKS.map((r, i) => (
            <li key={r.name} className={i <= rank.index ? 'on' : ''}>
              {r.name}
            </li>
          ))}
        </ol>
        <div className="stats">
          <div><b>{currentStreak(save)}</b><span>day streak</span></div>
          <div><b>{save.streak.best}</b><span>best streak</span></div>
          <div><b>{save.totalCorrect}</b><span>correct answers</span></div>
          <div><b>{Math.max(0, ...Object.values(save.speedBest))}</b><span>speed best</span></div>
        </div>
      </section>

      <section className="card panel">
        <h2>Achievements <small>{earned}/{ACHIEVEMENTS.length}</small></h2>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => (
            <li key={a.id} className={save.achievements[a.id] ? 'on' : ''}>
              <span className="icon">{save.achievements[a.id] ? a.icon : '🔒'}</span>
              <b>{a.name}</b>
              <small>{a.desc}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="card panel">
        <h2>History</h2>
        {save.history.length === 0 ? (
          <p className="hint">Nothing yet. Your quiz results will appear here.</p>
        ) : (
          <ul className="history">
            {save.history.slice(0, 25).map((h, i) => (
              <li key={i}>
                <span className={`dot ${h.passed === false ? 'fail' : 'ok'}`} />
                <span className="label">{h.label}</span>
                <span className="result">{h.kind === 'speed' ? `${h.correct} ✓` : `${h.correct}/${h.total}`}</span>
                <time>{new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card panel">
        <h2>Settings</h2>
        <label className="toggle">
          <input type="checkbox" checked={save.settings.sound} onChange={(e) => setting('sound', e.target.checked)} />
          Sound effects
        </label>
        <label className="toggle">
          <input type="checkbox" checked={save.settings.haptics} onChange={(e) => setting('haptics', e.target.checked)} />
          Vibration feedback
          {!hapticsSupported() && <small> (not supported by this browser)</small>}
        </label>
        <fieldset className="choice theme-choice">
          <legend>Appearance</legend>
          <div className="seg">
            {(
              [
                ['system', 'Match device'],
                ['light', '☀️ Light'],
                ['dark', '🌙 Dark'],
              ] as [Theme, string][]
            ).map(([t, label]) => (
              <button key={t} type="button" className={save.settings.theme === t ? 'on' : ''} aria-pressed={save.settings.theme === t} onClick={() => setTheme(t)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <h3>Move your progress</h3>
        <p className="hint">Everything is stored only in this browser. Export a file to carry it to another device, then import it there.</p>
        <div className="row">
          {shareable && (
            <button
              type="button"
              className="btn secondary"
              onClick={async () => {
                const result = await shareSave(save);
                if (result === 'shared') setMsg('Progress file shared.');
                else if (result === 'failed') {
                  // Never leave the tap doing nothing: fall back to a download.
                  exportSave(save);
                  setMsg('Sharing is not available here, so the progress file was saved to your downloads instead.');
                }
              }}
            >
              Share progress
            </button>
          )}
          <button type="button" className="btn secondary" onClick={() => { exportSave(save); setMsg('Progress file saved to your downloads.'); }}>
            {shareable ? 'Download file' : 'Export progress'}
          </button>
          <button type="button" className="btn secondary" onClick={() => file.current?.click()}>
            Import progress
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {msg && <p className="hint" role="status">{msg}</p>}
        <h3>Start over</h3>
        {confirmReset ? (
          <div className="row">
            <button type="button" className="btn danger" onClick={() => { setSave(freshSave()); setConfirmReset(false); setMsg('Progress erased.'); }}>
              Yes, erase everything
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
            Reset all progress
          </button>
        )}
      </section>
    </div>
  );
}

import { parts, working } from '../lib/roman';
import { buzz, play } from '../lib/fx';

/** A numeral shown as if carved into stone. Shrinks as it gets longer. */
export function Numeral({ value, small, struck }: { value: string; small?: boolean; struck?: boolean }) {
  const size = value.length > 11 ? 'xl' : value.length > 7 ? 'l' : value.length > 4 ? 'm' : 's';
  return (
    <div className={`numeral len-${size}${small ? ' small' : ''}${struck ? ' struck' : ''}`} aria-label={value.split('').join(' ')}>
      {value}
    </div>
  );
}

/** "M 1000 + CM 900 + ..." explanation of a number. */
export function Breakdown({ n }: { n: number }) {
  const ps = parts(n);
  return (
    <div className="breakdown" aria-label={`Breakdown of ${n}`}>
      {ps.map((p, i) => (
        <span key={i} className="chunk">
          <b>{p.roman}</b>
          <i>{p.roman.length === 2 && working(p.roman).includes('−') ? `${working(p.roman)} = ${p.value}` : p.value}</i>
        </span>
      ))}
      <span className="chunk total">
        <b>=</b>
        <i>{n}</i>
      </span>
    </div>
  );
}

/** On-screen keys for building an answer: Roman tiles or digits. */
export function Pad({ keys, onKey, onBack, disabled }: { keys: string[]; onKey: (k: string) => void; onBack: () => void; disabled?: boolean }) {
  return (
    <div className={`pad${keys.length > 7 ? ' digits' : ''}`}>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          className="tile"
          disabled={disabled}
          onClick={() => {
            play('tap');
            buzz(8);
            onKey(k);
          }}
        >
          {k}
        </button>
      ))}
      <button type="button" className="tile back" disabled={disabled} onClick={onBack} aria-label="Delete last">
        ⌫
      </button>
    </div>
  );
}

export function Laurels({ count, big }: { count: number; big?: boolean }) {
  return (
    <span className={`laurels${big ? ' big' : ''}`} aria-label={`${count} of 3 laurels`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? 'on' : 'off'} style={{ animationDelay: `${i * 0.18}s` }}>
          🌿
        </span>
      ))}
    </span>
  );
}

export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

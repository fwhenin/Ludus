// Sound (synthesised, no audio files), haptics and the celebration burst.

export const fxSettings = { sound: false, haptics: true };

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', gain = 0.12) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type Sound = 'tap' | 'good' | 'bad' | 'win' | 'fail';

export function play(sound: Sound) {
  if (!fxSettings.sound) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    if (sound === 'tap') tone(520, 0, 0.05, 'square', 0.04);
    if (sound === 'good') [660, 880].forEach((f, i) => tone(f, i * 0.09, 0.16));
    if (sound === 'bad') [220, 165].forEach((f, i) => tone(f, i * 0.12, 0.2, 'sawtooth', 0.06));
    if (sound === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3));
    if (sound === 'fail') [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, 'triangle', 0.08));
  } catch {
    // Audio is a nicety; never let it break the app.
  }
}

/** Vibrates where the browser supports it (Android); silently ignored elsewhere (iOS). */
export function buzz(pattern: number | number[]) {
  if (!fxSettings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked.
  }
}

export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function celebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  host.setAttribute('aria-hidden', 'true');
  const colours = ['#c9a227', '#5b7a3a', '#b4432c', '#7a1f3d', '#e8c66a'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('span');
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 90}vw`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.setProperty('--d', `${1.1 + Math.random() * 0.9}s`);
    p.style.background = colours[i % colours.length];
    p.style.left = `${45 + Math.random() * 10}%`;
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2200);
}

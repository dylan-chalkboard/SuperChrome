export type BackdropVariant = 'light' | 'dark'

/** Picks the backdrop theme from the user's appearance setting + OS preference. */
export function backdropVariant(
  appearance: 'system' | 'light' | 'dark',
  prefersLight: boolean,
): BackdropVariant {
  if (appearance === 'light') return 'light'
  if (appearance === 'dark') return 'dark'
  return prefersLight ? 'light' : 'dark'
}

// Soft vertical light beams: position (vw), width (px), opacity, sway seconds.
// Hand-tuned for a calm, non-repeating composition.
const BEAMS: Array<{ x: number; w: number; o: number; dur: number; delay: number }> = [
  { x: 8, w: 140, o: 0.35, dur: 17, delay: 0 },
  { x: 22, w: 90, o: 0.22, dur: 21, delay: -6 },
  { x: 38, w: 200, o: 0.45, dur: 19, delay: -3 },
  { x: 52, w: 110, o: 0.3, dur: 23, delay: -9 },
  { x: 66, w: 170, o: 0.4, dur: 18, delay: -2 },
  { x: 80, w: 95, o: 0.24, dur: 22, delay: -7 },
  { x: 92, w: 150, o: 0.33, dur: 20, delay: -4 },
]

export const BACKDROP_CSS = `
html, body { margin: 0; height: 100%; overflow: hidden; }
.nt-backdrop {
  position: fixed; inset: 0; z-index: 0; overflow: hidden;
  background:
    radial-gradient(130% 120% at 50% 38%, #1b3f86 0%, #12305f 40%, #0a1d44 68%, #050c1f 100%);
}
/* Ambient glow that gently drifts so the whole field feels alive. */
.nt-backdrop::after {
  content: ''; position: absolute; inset: -20%;
  background: radial-gradient(45% 55% at 50% 42%, rgba(70,130,255,0.35), transparent 70%);
  animation: nt-glow 24s ease-in-out infinite;
}
.nt-beams { position: absolute; inset: 0; }
.nt-beam {
  position: absolute; top: -20%; height: 140%;
  background: linear-gradient(to bottom,
    transparent 0%, rgba(150,195,255,0.9) 45%, rgba(190,220,255,0.95) 55%, transparent 100%);
  filter: blur(34px);
  mix-blend-mode: screen;
  transform: translateX(0);
  animation: nt-sway var(--dur, 20s) ease-in-out infinite;
  animation-delay: var(--delay, 0s);
  will-change: transform, opacity;
}
.nt-backdrop .nt-mark {
  position: fixed; left: 20px; bottom: 16px; z-index: 1;
  height: 20px; width: auto; opacity: 0.5;
  filter: drop-shadow(0 1px 6px rgba(0,0,0,0.45));
  pointer-events: none;
}
/* Light theme */
.nt-backdrop.light {
  background: radial-gradient(130% 120% at 50% 38%, #eaf2ff 0%, #c3d9ff 45%, #93b6ff 100%);
}
.nt-backdrop.light::after {
  background: radial-gradient(45% 55% at 50% 42%, rgba(255,255,255,0.5), transparent 70%);
}
.nt-backdrop.light .nt-beam {
  mix-blend-mode: soft-light;
  background: linear-gradient(to bottom,
    transparent 0%, rgba(255,255,255,0.95) 50%, transparent 100%);
}
.nt-backdrop.light .nt-mark { filter: invert(1) drop-shadow(0 1px 6px rgba(0,0,0,0.15)); }
@keyframes nt-sway {
  0%, 100% { transform: translateX(-14px); opacity: 0.75; }
  50% { transform: translateX(14px); opacity: 1; }
}
@keyframes nt-glow {
  0%, 100% { transform: translateX(-4%) scale(1); opacity: 0.85; }
  50% { transform: translateX(4%) scale(1.06); opacity: 1; }
}
/* Reduce-motion: hold everything still. */
.nt-static::after { animation: none; }
.nt-static .nt-beam { animation: none; opacity: 0.9; }
`

/** Builds the backdrop DOM. Caller appends style to <head> and root to <body>. */
export function buildBackdrop(opts: { variant: BackdropVariant; motion: boolean }): {
  style: HTMLStyleElement
  root: HTMLElement
} {
  const style = document.createElement('style')
  style.textContent = BACKDROP_CSS

  const root = document.createElement('div')
  root.className = `nt-backdrop ${opts.variant === 'light' ? 'light' : ''} ${
    opts.motion ? '' : 'nt-static'
  }`
    .replace(/\s+/g, ' ')
    .trim()

  const beams = document.createElement('div')
  beams.className = 'nt-beams'
  for (const b of BEAMS) {
    const beam = document.createElement('div')
    beam.className = 'nt-beam'
    beam.style.left = `${b.x}vw`
    beam.style.width = `${b.w}px`
    beam.style.opacity = String(b.o)
    beam.style.setProperty('--dur', `${b.dur}s`)
    beam.style.setProperty('--delay', `${b.delay}s`)
    beams.appendChild(beam)
  }

  const mark = document.createElement('img')
  mark.className = 'nt-mark'
  mark.src = 'icons/footer.png'
  mark.alt = 'SuperChrome'

  root.append(beams, mark)
  return { style, root }
}

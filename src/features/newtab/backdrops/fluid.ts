import { createDomBackdrop } from '../backdrop-core'

const FLUID_CSS = `
.nt-fluid { background: #030d08 !important; }
.nt-fluid-fold { position: absolute; inset: -20%; pointer-events: none; filter: blur(46px); }
.nt-fluid-fold.one {
  background: radial-gradient(ellipse 40% 23% at 17% 23%, rgba(48,119,39,.7), transparent 80%),
              radial-gradient(ellipse 29% 34% at 86% 32%, rgba(74,150,35,.62), transparent 79%);
  animation: nt-fluid-one var(--nt-fluid-a) ease-in-out infinite alternate;
}
.nt-fluid-fold.two {
  background: radial-gradient(ellipse 35% 38% at 50% 30%, rgba(30,88,36,.58), transparent 80%),
              radial-gradient(ellipse 25% 29% at 95% 76%, rgba(47,126,42,.45), transparent 80%);
  mix-blend-mode: screen;
  animation: nt-fluid-two var(--nt-fluid-b) ease-in-out infinite alternate;
}
.nt-fluid-fold.three {
  background: conic-gradient(from 42deg at 48% 37%, transparent 0deg, rgba(13,52,20,.62) 47deg,
              transparent 102deg, rgba(53,119,36,.23) 170deg, transparent 235deg);
  opacity: .5; filter: blur(75px);
  animation: nt-fluid-three var(--nt-fluid-c) ease-in-out infinite alternate;
}
.nt-fluid-shade { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 72% 49% at 50% 50%, transparent 25%, rgba(0,5,3,.53) 100%),
              linear-gradient(180deg, transparent 28%, rgba(0,8,4,.58));
}
.nt-fluid.still .nt-fluid-fold, .nt-fluid.paused .nt-fluid-fold { animation-play-state: paused; }
.nt-fluid.still .nt-fluid-fold { animation: none; }
@keyframes nt-fluid-one { from { transform: translate3d(-5%, -2%, 0) rotate(-4deg) scale(1.02); } to { transform: translate3d(5%, 3%, 0) rotate(5deg) scale(1.12); } }
@keyframes nt-fluid-two { from { transform: translate3d(5%, -4%, 0) scale(1.05, .94); } to { transform: translate3d(-5%, 5%, 0) scale(.95, 1.08); } }
@keyframes nt-fluid-three { from { transform: rotate(-8deg) scale(1.08); } to { transform: rotate(9deg) scale(.98); } }
`

/** Slow, soft color folds inspired by the supplied dark-green fluid reference. */
export const mountFluid = createDomBackdrop((root, opts) => {
  root.classList.add('nt-fluid')
  if (!opts.motion) root.classList.add('still')
  const speed = Math.max(0.25, opts.speed ?? 1)
  root.style.setProperty('--nt-fluid-a', `${16 / speed}s`)
  root.style.setProperty('--nt-fluid-b', `${21 / speed}s`)
  root.style.setProperty('--nt-fluid-c', `${27 / speed}s`)
  const style = document.createElement('style')
  style.textContent = FLUID_CSS
  root.appendChild(style)
  for (const name of ['one', 'two', 'three']) {
    const fold = document.createElement('div')
    fold.className = `nt-fluid-fold ${name}`
    root.appendChild(fold)
  }
  const shade = document.createElement('div')
  shade.className = 'nt-fluid-shade'
  root.appendChild(shade)
  const onVisibility = (): void => { root.classList.toggle('paused', document.hidden) }
  document.addEventListener('visibilitychange', onVisibility)
  onVisibility()
  return () => document.removeEventListener('visibilitychange', onVisibility)
})

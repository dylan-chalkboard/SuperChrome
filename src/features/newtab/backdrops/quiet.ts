import { createDomBackdrop } from '../backdrop-core'

const QUIET_CSS = `
.nt-quiet { background: #101722 !important; }
.nt-quiet-haze { position: absolute; inset: -18%; pointer-events: none;
  background: radial-gradient(ellipse 68% 46% at 52% 87%, rgba(68,91,116,.37), transparent 83%),
              radial-gradient(ellipse 35% 27% at 74% 11%, rgba(108,115,143,.23), transparent 83%);
  filter: blur(45px); animation: nt-quiet-drift var(--nt-quiet-duration) ease-in-out infinite alternate;
}
.nt-quiet.still .nt-quiet-haze, .nt-quiet.paused .nt-quiet-haze { animation-play-state: paused; }
.nt-quiet.still .nt-quiet-haze { animation: none; }
@keyframes nt-quiet-drift { from { transform: translate3d(-2%, 1%, 0); opacity: .72; }
  to { transform: translate3d(2%, -1%, 0); opacity: 1; } }
`

export const mountQuiet = createDomBackdrop((root, opts) => {
  root.classList.add('nt-quiet')
  if (!opts.motion) root.classList.add('still')
  root.style.setProperty('--nt-quiet-duration', `${24 / Math.max(0.25, opts.speed ?? 1)}s`)
  const style = document.createElement('style')
  style.textContent = QUIET_CSS
  const haze = document.createElement('div')
  haze.className = 'nt-quiet-haze'
  root.append(style, haze)
  const onVisibility = (): void => { root.classList.toggle('paused', document.hidden) }
  document.addEventListener('visibilitychange', onVisibility)
  onVisibility()
  return () => document.removeEventListener('visibilitychange', onVisibility)
})

import { createDomBackdrop } from '../backdrop-core'

const GRADIENT_CSS = `
@keyframes nt-grad-shift {
  0%   { background-position:   0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position:   0% 50%; }
}
.nt-grad {
  position: absolute; inset: 0; z-index: 0;
  background-size: 300% 300%;
  animation: nt-grad-shift 34s ease-in-out infinite;
  filter: saturate(1.05);
}
.nt-grad.dark {
  background-image: linear-gradient(125deg, #101a33, #22254f, #123a4e, #0d1830);
}
.nt-grad.light {
  background-image: linear-gradient(125deg, #eef2fc, #e7e9fb, #e2f0fb, #f3ecfa);
}
.nt-grad.paused { animation: none; }
`

/** A smooth multi-color gradient slowly shifting position. Pure CSS, no canvas. */
export const mountGradient = createDomBackdrop((root, opts) => {
  const style = document.createElement('style')
  style.textContent = GRADIENT_CSS

  const layer = document.createElement('div')
  const cls = ['nt-grad', opts.variant === 'light' ? 'light' : 'dark']
  if (!opts.motion) cls.push('paused')
  layer.className = cls.join(' ')
  // Base 34s cycle, sped up or slowed by the speed multiplier.
  layer.style.animationDuration = `${34 / (opts.speed ?? 1)}s`

  root.append(style, layer)
  return () => {
    style.remove()
    layer.remove()
  }
})

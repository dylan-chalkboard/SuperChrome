import { createDomBackdrop } from '../backdrop-core'
import type { MountFn } from '../backdrop-core'

const MINIMAL_CSS = `
.nt-minimal { overflow: hidden; background: #101010; }
.nt-minimal-image {
  position: absolute; inset: -4%; pointer-events: none;
  background-position: center; background-size: cover;
  animation: nt-minimal-drift var(--nt-minimal-duration) ease-in-out infinite alternate;
}
.nt-minimal.still .nt-minimal-image { animation: none; }
.nt-minimal.paused .nt-minimal-image { animation-play-state: paused; }
.nt-minimal .nt-vignette { display: none; }
@keyframes nt-minimal-drift {
  from { transform: translate3d(-.4%, 0, 0) scale(1.01); }
  to { transform: translate3d(.4%, 0, 0) scale(1.025); }
}
`

function mountMinimal(imageName: string): MountFn {
  return createDomBackdrop((root, opts) => {
    root.classList.add('nt-minimal')
    if (!opts.motion) root.classList.add('still')
    const speed = Math.max(0.25, opts.speed ?? 1)
    root.style.setProperty('--nt-minimal-duration', `${55 / speed}s`)
    const style = document.createElement('style')
    style.textContent = MINIMAL_CSS
    const image = document.createElement('div')
    image.className = 'nt-minimal-image'
    image.style.backgroundImage = `url(${chrome.runtime.getURL(`backgrounds/${imageName}.svg`)})`
    root.prepend(style, image)
    if (!opts.motion) return
    const onVisibility = (): void => { root.classList.toggle('paused', document.hidden) }
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })
}

export const mountCharcoalFolds = mountMinimal('charcoal-folds')
export const mountDarkFacets = mountMinimal('dark-facets')
export const mountWovenSand = mountMinimal('woven-sand')
export const mountWovenSage = mountMinimal('woven-sage')
export const mountWovenBlue = mountMinimal('woven-blue')
export const mountChevronGold = mountMinimal('chevron-gold')
export const mountChevronInk = mountMinimal('chevron-ink')
export const mountInterlockBlue = mountMinimal('interlock-blue')
export const mountInterlockOlive = mountMinimal('interlock-olive')

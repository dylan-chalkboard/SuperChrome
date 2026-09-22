import { createDomBackdrop } from '../backdrop-core'
import type { MountFn } from '../backdrop-core'

interface ArtworkScene {
  image: string
  base: string
  glow: string
}

const ARTWORK_CSS = `
.nt-artwork { overflow: hidden; }
.nt-artwork-image, .nt-artwork-echo, .nt-artwork-glow {
  position: absolute; inset: 0; pointer-events: none;
}
.nt-artwork-image {
  background-position: center; background-size: cover;
  transform: scale(1.035);
  animation: nt-artwork-float var(--nt-artwork-duration) ease-in-out infinite alternate;
}
.nt-artwork-echo {
  inset: -8%; background-position: center; background-size: cover;
  opacity: .13; filter: blur(28px); mix-blend-mode: soft-light;
  animation: nt-artwork-echo var(--nt-echo-duration) ease-in-out infinite alternate;
}
.nt-artwork-glow {
  inset: -10%; opacity: .2;
  background: radial-gradient(ellipse 38% 43% at 24% 31%, var(--nt-artwork-glow), transparent 82%);
  mix-blend-mode: soft-light;
  animation: nt-artwork-glow var(--nt-glow-duration) ease-in-out infinite alternate;
}
.nt-artwork.still .nt-artwork-image,
.nt-artwork.still .nt-artwork-echo,
.nt-artwork.still .nt-artwork-glow { animation: none; }
.nt-artwork.paused .nt-artwork-image,
.nt-artwork.paused .nt-artwork-echo,
.nt-artwork.paused .nt-artwork-glow { animation-play-state: paused; }
@keyframes nt-artwork-float {
  from { transform: scale(1.035) translate3d(-.8%, .4%, 0); }
  to { transform: scale(1.09) translate3d(.8%, -.5%, 0); }
}
@keyframes nt-artwork-echo {
  from { transform: translate3d(-3%, 1%, 0) scale(1.02); opacity: .08; }
  to { transform: translate3d(3%, -1%, 0) scale(1.08); opacity: .2; }
}
@keyframes nt-artwork-glow {
  from { transform: translate3d(-7%, -2%, 0); opacity: .08; }
  to { transform: translate3d(42%, 8%, 0); opacity: .25; }
}
`

function mountArtwork(scene: ArtworkScene): MountFn {
  return createDomBackdrop((root, opts) => {
    root.classList.add('nt-artwork')
    if (!opts.motion) root.classList.add('still')
    root.style.background = scene.base
    root.style.setProperty('--nt-artwork-glow', scene.glow)
    const speed = Math.max(0.25, opts.speed ?? 1)
    root.style.setProperty('--nt-artwork-duration', `${18 / speed}s`)
    root.style.setProperty('--nt-echo-duration', `${13 / speed}s`)
    root.style.setProperty('--nt-glow-duration', `${15 / speed}s`)

    const style = document.createElement('style')
    style.textContent = ARTWORK_CSS
    const image = document.createElement('div')
    image.className = 'nt-artwork-image'
    const echo = document.createElement('div')
    echo.className = 'nt-artwork-echo'
    const url = `url(${chrome.runtime.getURL(`backgrounds/${scene.image}.webp`)})`
    image.style.backgroundImage = url
    echo.style.backgroundImage = url
    const glow = document.createElement('div')
    glow.className = 'nt-artwork-glow'
    root.prepend(style, image, echo, glow)

    if (!opts.motion) return
    const onVisibility = (): void => { root.classList.toggle('paused', document.hidden) }
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })
}

export const mountLiquidRibbons = mountArtwork({
  image: 'liquid-ribbons', base: '#050407', glow: 'rgba(202,156,255,.8)',
})
export const mountPeachGel = mountArtwork({
  image: 'peach-gel', base: '#fff0df', glow: 'rgba(255,135,83,.65)',
})
export const mountPastelBlobs = mountArtwork({
  image: 'pastel-blobs', base: '#268fdd', glow: 'rgba(255,122,176,.65)',
})
export const mountSilkPlume = mountArtwork({
  image: 'silk-plume', base: '#4e364f', glow: 'rgba(255,169,198,.72)',
})
export const mountLightColumns = mountArtwork({
  image: 'light-columns', base: '#fff7ed', glow: 'rgba(255,176,72,.7)',
})
export const mountColorMarbling = mountArtwork({
  image: 'color-marbling', base: '#74b7eb', glow: 'rgba(255,221,93,.72)',
})
export const mountNeonLiquid = mountArtwork({
  image: 'neon-liquid', base: '#041730', glow: 'rgba(45,221,255,.8)',
})

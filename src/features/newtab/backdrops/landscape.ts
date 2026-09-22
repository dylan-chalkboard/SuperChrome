import { createDomBackdrop } from '../backdrop-core'
import type { MountFn } from '../backdrop-core'

interface LandscapeScene {
  image: string
  base: string
  mist: string
  light: string
  mistTop: string
}

const LANDSCAPE_CSS = `
.nt-landscape { overflow: hidden; }
.nt-landscape-image, .nt-landscape-mist, .nt-landscape-light, .nt-landscape-shade {
  position: absolute; inset: 0; pointer-events: none;
}
.nt-landscape-image {
  background-position: center; background-size: cover;
  transform: scale(1.035); animation: nt-landscape-breathe var(--nt-image-duration) ease-in-out infinite alternate;
}
.nt-landscape-mist {
  inset: -12%; opacity: .6;
  background: radial-gradient(ellipse 45% 20% at 24% var(--nt-mist-top), var(--nt-mist), transparent 80%),
              radial-gradient(ellipse 50% 17% at 78% 65%, var(--nt-mist), transparent 82%);
  filter: blur(32px);
  animation: nt-landscape-drift var(--nt-mist-duration) ease-in-out infinite alternate;
}
.nt-landscape-light {
  opacity: .28;
  background: radial-gradient(ellipse 48% 30% at 77% 24%, var(--nt-light), transparent 78%);
  mix-blend-mode: screen;
  animation: nt-landscape-glow var(--nt-light-duration) ease-in-out infinite alternate;
}
.nt-landscape-shade {
  background: radial-gradient(ellipse 60% 50% at 50% 36%, rgba(0,0,0,.22), transparent 85%),
              linear-gradient(180deg, rgba(0,0,0,.08), transparent 28%, rgba(0,0,0,.28));
}
.nt-landscape.photo-bright .nt-landscape-shade,
.nt-landscape.photo-bright .nt-vignette { display: none; }
.nt-landscape.still .nt-landscape-image,
.nt-landscape.still .nt-landscape-mist,
.nt-landscape.still .nt-landscape-light,
.nt-landscape.paused .nt-landscape-image,
.nt-landscape.paused .nt-landscape-mist,
.nt-landscape.paused .nt-landscape-light { animation-play-state: paused; }
.nt-landscape.still .nt-landscape-image { animation: none; transform: scale(1.025); }
.nt-landscape.still .nt-landscape-mist { animation: none; transform: translateX(1%); }
.nt-landscape.still .nt-landscape-light { animation: none; opacity: .25; }
@keyframes nt-landscape-breathe { to { transform: scale(1.085) translate3d(-.65%, .5%, 0); } }
@keyframes nt-landscape-drift { from { transform: translate3d(-6%, 0, 0); opacity: .3; } to { transform: translate3d(6%, -2%, 0); opacity: .68; } }
@keyframes nt-landscape-glow { from { opacity: .12; transform: translate3d(-3%, 0, 0); } to { opacity: .42; transform: translate3d(2%, 1%, 0); } }
`

function mountLandscape(scene: LandscapeScene): MountFn {
  return createDomBackdrop((root, opts) => {
    root.classList.add('nt-landscape')
    if (opts.darkenPhotos === false) root.classList.add('photo-bright')
    if (!opts.motion) root.classList.add('still')
    root.style.background = scene.base
    root.style.setProperty('--nt-mist', scene.mist)
    root.style.setProperty('--nt-light', scene.light)
    root.style.setProperty('--nt-mist-top', scene.mistTop)
    const speed = Math.max(0.25, opts.speed ?? 1)
    root.style.setProperty('--nt-image-duration', `${48 / speed}s`)
    root.style.setProperty('--nt-mist-duration', `${18 / speed}s`)
    root.style.setProperty('--nt-light-duration', `${13 / speed}s`)

    const style = document.createElement('style')
    style.textContent = LANDSCAPE_CSS
    const image = document.createElement('div')
    image.className = 'nt-landscape-image'
    image.style.backgroundImage = `url(${chrome.runtime.getURL(`backgrounds/${scene.image}.webp`)})`
    const mist = document.createElement('div')
    mist.className = 'nt-landscape-mist'
    const light = document.createElement('div')
    light.className = 'nt-landscape-light'
    const shade = document.createElement('div')
    shade.className = 'nt-landscape-shade'
    root.prepend(style, image, mist, light, shade)

    const onVisibility = (): void => { root.classList.toggle('paused', document.hidden) }
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })
}

export const mountMountainRiver = mountLandscape({
  image: 'mountain-river', base: '#101c19', mist: 'rgba(177,201,177,.38)',
  light: 'rgba(158,216,142,.3)', mistTop: '59%',
})
export const mountMistyCoast = mountLandscape({
  image: 'misty-coast', base: '#243447', mist: 'rgba(204,220,231,.4)',
  light: 'rgba(255,199,163,.34)', mistTop: '43%',
})
export const mountDesertLight = mountLandscape({
  image: 'desert-light', base: '#49301d', mist: 'rgba(238,178,104,.27)',
  light: 'rgba(255,198,96,.3)', mistTop: '47%',
})
export const mountForestDusk = mountLandscape({
  image: 'forest-dusk', base: '#152339', mist: 'rgba(152,170,196,.31)',
  light: 'rgba(202,157,198,.2)', mistTop: '52%',
})
export const mountMoonlitLake = mountLandscape({
  image: 'moonlit-lake', base: '#0b1a27', mist: 'rgba(121,196,217,.39)',
  light: 'rgba(170,220,242,.32)', mistTop: '57%',
})
export const mountEnchantedForest = mountLandscape({
  image: 'enchanted-forest', base: '#10231b', mist: 'rgba(130,205,161,.35)',
  light: 'rgba(198,223,128,.3)', mistTop: '56%',
})
export const mountAlpineDawn = mountLandscape({
  image: 'alpine-dawn', base: '#1d273f', mist: 'rgba(204,217,231,.35)',
  light: 'rgba(255,194,157,.3)', mistTop: '52%',
})
export const mountVolcanicCoast = mountLandscape({
  image: 'volcanic-coast', base: '#171826', mist: 'rgba(178,175,199,.34)',
  light: 'rgba(218,164,198,.27)', mistTop: '47%',
})
export const mountRainyCity = mountLandscape({
  image: 'rainy-city', base: '#162135', mist: 'rgba(129,166,207,.31)',
  light: 'rgba(240,183,122,.25)', mistTop: '44%',
})
export const mountRiversideCity = mountLandscape({
  image: 'riverside-city', base: '#211c2d', mist: 'rgba(182,165,198,.31)',
  light: 'rgba(250,183,113,.27)', mistTop: '46%',
})

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

/** Monochrome dot ink: white on the dark theme, near-black on the light theme. */
export function dotInk(variant: BackdropVariant, a: number): string {
  return variant === 'light' ? `rgba(18,22,38,${a})` : `rgba(255,255,255,${a})`
}

export const BACKDROP_CSS = `
html, body { margin: 0; height: 100%; overflow: hidden; }
.nt-backdrop { position: fixed; inset: 0; z-index: 0; background: #05070f; }
.nt-backdrop.light { background: #f5f7ff; }
.nt-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.nt-mark {
  position: fixed; left: 20px; bottom: 16px; z-index: 1;
  height: 18px; width: auto; opacity: 0.45; pointer-events: none;
  filter: drop-shadow(0 1px 6px rgba(0,0,0,0.45));
}
.nt-backdrop.light .nt-mark { filter: invert(1) drop-shadow(0 1px 6px rgba(0,0,0,0.12)); }
`

const GAP = 22 // px between dots

/**
 * Mounts the animated halftone dot-wave into `container`. Dots pulse in size and
 * opacity from a flowing sine field, coloured along a pink→purple→cyan gradient,
 * denser toward the bottom and fading out near the top. Returns a stop handle.
 */
export function mountBackdrop(
  container: HTMLElement,
  opts: { variant: BackdropVariant; motion: boolean },
): () => void {
  const style = document.createElement('style')
  style.textContent = BACKDROP_CSS

  const root = document.createElement('div')
  root.className = `nt-backdrop ${opts.variant === 'light' ? 'light' : ''}`.trim()

  const canvas = document.createElement('canvas')
  canvas.className = 'nt-canvas'
  root.appendChild(canvas)

  const mark = document.createElement('img')
  mark.className = 'nt-mark'
  mark.src = 'icons/footer.png'
  mark.alt = 'SuperChrome'
  root.appendChild(mark)

  container.append(style, root)

  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let dpr = 1
  let vw = 0
  let vh = 0
  const resize = (): void => {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    vw = window.innerWidth
    vh = window.innerHeight
    canvas.width = Math.floor(vw * dpr)
    canvas.height = Math.floor(vh * dpr)
  }
  resize()

  const draw = (time: number): void => {
    const t = time * 0.001
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)
    for (let y = 0; y <= vh + GAP; y += GAP) {
      const ny = y / vh
      // Depth: dots grow and brighten toward the bottom, fade out up top.
      const vert = Math.pow(Math.min(1, ny), 1.25)
      if (vert < 0.02) continue
      for (let x = 0; x <= vw + GAP; x += GAP) {
        const nx = x / vw
        // Flowing surface: a few sines plus a swirl term for organic wave bands.
        const wave =
          Math.sin(nx * 7 + t * 1.1) +
          Math.sin(ny * 5 - t * 0.9) +
          Math.sin((nx + ny) * 6 + t * 0.6) +
          Math.sin(Math.hypot(nx - 0.5, ny - 0.5) * 12 - t * 1.3)
        const v = (wave + 4) / 8 // 0..1
        // Thickness is the effect: crest dots read clearly, troughs vanish.
        const s = Math.pow(v, 1.7)
        const r = s * (GAP * 0.18) * (0.4 + 0.6 * vert)
        if (r < 0.35) continue
        const alpha = (0.55 + 0.45 * s) * (0.18 + 0.82 * vert)
        ctx.fillStyle = dotInk(opts.variant, alpha)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  let raf = 0
  const loop = (time: number): void => {
    draw(time)
    raf = requestAnimationFrame(loop)
  }
  const onResize = (): void => {
    resize()
    if (!opts.motion) draw(0)
  }
  window.addEventListener('resize', onResize)

  if (opts.motion) raf = requestAnimationFrame(loop)
  else draw(0)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
  }
}

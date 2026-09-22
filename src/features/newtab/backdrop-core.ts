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

// Subtle fractal-noise grain, embedded so no network fetch is needed. It gives
// every backdrop the faint film texture of an Apple wallpaper.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export const BACKDROP_CSS = `
.nt-backdrop {
  position: fixed; inset: 0; z-index: 0; overflow: hidden;
  background: radial-gradient(135% 115% at 50% 100%, #0c1226 0%, #070a16 52%, #04050c 100%);
}
.nt-backdrop.contained { position: absolute; }
.nt-backdrop.light {
  background: radial-gradient(135% 115% at 50% 0%, #ffffff 0%, #eef1fb 55%, #e6eaf6 100%);
}
.nt-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; }
.nt-vignette {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(125% 125% at 50% 42%, transparent 52%, rgba(2,3,10,0.55) 100%);
}
.nt-backdrop.light .nt-vignette {
  background: radial-gradient(130% 130% at 50% 30%, transparent 58%, rgba(60,70,110,0.14) 100%);
}
.nt-grain {
  position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background-image: ${GRAIN}; background-size: 160px 160px;
  opacity: 0.05; mix-blend-mode: soft-light;
}
.nt-backdrop.light .nt-grain { opacity: 0.04; mix-blend-mode: multiply; }
.nt-mark {
  position: fixed; left: 20px; bottom: 16px; z-index: 4;
  height: 18px; width: auto; opacity: 0.4; pointer-events: none;
  filter: drop-shadow(0 1px 6px rgba(0,0,0,0.45));
}
.nt-backdrop.light .nt-mark { filter: invert(1) drop-shadow(0 1px 6px rgba(0,0,0,0.12)); }
`

export interface BackdropOpts {
  variant: BackdropVariant
  /** When false, a single static frame is drawn (t = 0) and no loop runs. */
  motion: boolean
  /** Hide the SuperChrome wordmark (used by option-page preview thumbnails). */
  hideMark?: boolean
  /** Render absolute within the container instead of fixed to the viewport. */
  contained?: boolean
  /** Animation speed multiplier (1 = normal). Defaults to 1 when omitted. */
  speed?: number
  /** Keep the legibility shade over photographic scenes. Defaults to on. */
  darkenPhotos?: boolean
}

/** A backdrop takes over `container` and returns a handle that tears it down. */
export type MountFn = (container: HTMLElement, opts: BackdropOpts) => () => void

/** Per-frame drawing state handed to a canvas backdrop's `draw`. */
export interface Frame {
  ctx: CanvasRenderingContext2D
  /** Elapsed seconds, already scaled by the speed multiplier. */
  t: number
  /** CSS-pixel viewport width/height (context is already DPR-scaled). */
  vw: number
  vh: number
  variant: BackdropVariant
  /** Speed multiplier (1 = normal). Frame-stepped effects multiply deltas by it. */
  speed: number
}

/** Builds the `.nt-backdrop` root (style, canvas, wordmark) inside `container`. */
function buildRoot(
  container: HTMLElement,
  opts: BackdropOpts,
): { root: HTMLDivElement; canvas: HTMLCanvasElement; style: HTMLStyleElement } {
  const style = document.createElement('style')
  style.textContent = BACKDROP_CSS

  const root = document.createElement('div')
  const classes = ['nt-backdrop']
  if (opts.variant === 'light') classes.push('light')
  if (opts.contained) classes.push('contained')
  root.className = classes.join(' ')
  // Style lives inside root so a single root.remove() tears everything down
  // (previews re-mount repeatedly and must not leak <style> nodes).
  root.appendChild(style)

  const canvas = document.createElement('canvas')
  canvas.className = 'nt-canvas'
  root.appendChild(canvas)

  // Depth (vignette) + film grain unify the set. Skipped in tiny previews,
  // where the grain would read as noise and the vignette would crush detail.
  if (opts.contained !== true) {
    const vignette = document.createElement('div')
    vignette.className = 'nt-vignette'
    const grain = document.createElement('div')
    grain.className = 'nt-grain'
    root.append(vignette, grain)
  }

  if (opts.hideMark !== true) {
    const mark = document.createElement('img')
    mark.className = 'nt-mark'
    mark.src = 'icons/footer.png'
    mark.alt = 'SuperChrome'
    root.appendChild(mark)
  }

  container.appendChild(root)
  return { root, canvas, style }
}

/** What an animation's per-mount setup returns. */
export interface CanvasScene {
  draw: (frame: Frame) => void
  /** Rebuild size-dependent state (e.g. particle positions) on viewport change. */
  onResize?: (vw: number, vh: number) => void
  /**
   * Keep the canvas between frames instead of clearing it — for trail effects
   * that fade the previous frame themselves. When set, `clear` lays the opaque
   * base on mount/resize, and a static (reduce-motion) render warms up by
   * running `draw` `warmup` times.
   */
  persist?: boolean
  clear?: (frame: Frame) => void
  warmup?: number
}

/**
 * Wraps a canvas animation into a full backdrop mount: it owns the canvas, DPR
 * scaling, resize handling, the RAF loop, and motion/reduce-motion (a single
 * static frame when `motion` is false).
 *
 * `setup` runs once per mount, so animations can hold per-instance state (e.g.
 * particle arrays) in its closure. Stateless animations just return `{ draw }`.
 */
export function createCanvasBackdrop(setup: () => CanvasScene): MountFn {
  return (container, opts) => {
    const { root, canvas } = buildRoot(container, opts)
    const ctx = canvas.getContext('2d')
    if (!ctx) return () => root.remove()

    const scene = setup()
    const { draw, onResize } = scene
    const persist = scene.persist === true

    let dpr = 1
    let vw = 0
    let vh = 0
    const measure = (): void => {
      // In a thumbnail the canvas is sized by CSS; fall back to the window.
      const rect = canvas.getBoundingClientRect()
      vw = Math.max(1, Math.round(rect.width) || window.innerWidth)
      vh = Math.max(1, Math.round(rect.height) || window.innerHeight)
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.floor(vw * dpr)
      canvas.height = Math.floor(vh * dpr)
    }
    const speed = opts.speed ?? 1
    // Time-based effects read the scaled `t`; frame-stepped ones scale by `speed`.
    const frame = (t: number): Frame => ({ ctx, t: t * speed, vw, vh, variant: opts.variant, speed })
    const resize = (): void => {
      measure()
      onResize?.(vw, vh)
      // A resize wipes the canvas, so persistent trails must relay their base.
      if (persist) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        scene.clear?.(frame(0))
      }
    }
    resize()

    const paint = (time: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!persist) ctx.clearRect(0, 0, vw, vh)
      draw(frame(time * 0.001))
    }

    let raf = 0
    const loop = (time: number): void => {
      paint(time)
      raf = requestAnimationFrame(loop)
    }
    const onResizeEvent = (): void => {
      resize()
      if (!opts.motion) staticFrame()
    }
    // A still image of a trail effect needs the growth built up first.
    const staticFrame = (): void => {
      if (persist && scene.warmup) {
        for (let i = 0; i < scene.warmup; i++) paint(i * 16)
      } else {
        paint(0)
      }
    }
    window.addEventListener('resize', onResizeEvent)

    if (opts.motion) raf = requestAnimationFrame(loop)
    else staticFrame()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResizeEvent)
      root.remove()
    }
  }
}

/**
 * A DOM-based (non-canvas) backdrop. `render` receives the themed `.nt-backdrop`
 * root (which already carries a hidden canvas + wordmark) and the mount opts, and
 * may append its own elements and return a cleanup callback.
 */
export function createDomBackdrop(
  render?: (root: HTMLDivElement, opts: BackdropOpts) => (() => void) | void,
): MountFn {
  return (container, opts) => {
    const { root, canvas } = buildRoot(container, opts)
    canvas.remove() // DOM backdrops don't paint a canvas.
    const cleanup = render?.(root, opts)
    return () => {
      cleanup?.()
      root.remove()
    }
  }
}

/** A static (non-canvas) backdrop: just the themed background + wordmark. */
export function createStaticBackdrop(): MountFn {
  return createDomBackdrop()
}

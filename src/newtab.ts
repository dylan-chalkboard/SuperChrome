import { backdropVariant } from './features/newtab/backdrop'
import { resolveBackdrop } from './features/newtab/registry'
import { DEFAULT_BACKDROP_ID } from './features/newtab/backdrop-meta'

// Set before palette.js is injected so it opens the menu immediately as the page.
// (Inline <script> can't do this — MV3 extension-page CSP blocks inline code.)
;(window as unknown as { __scPageMode?: boolean }).__scPageMode = true

interface BackdropPrefs {
  appearance: 'system' | 'light' | 'dark'
  reduceMotion: boolean
  backdrop: string
  backdropSpeed: number
  darkenPhotos: boolean
}

function parsePrefs(settings: Record<string, unknown> | undefined): BackdropPrefs {
  return {
    appearance: settings?.appearance === 'light' || settings?.appearance === 'dark'
      ? settings.appearance : 'system',
    reduceMotion: settings?.reduceMotion === true,
    backdrop: typeof settings?.backdrop === 'string' ? settings.backdrop : DEFAULT_BACKDROP_ID,
    backdropSpeed: typeof settings?.backdropSpeed === 'number' ? settings.backdropSpeed : 1,
    darkenPhotos: settings?.darkenPhotos !== false,
  }
}

async function readPrefs(): Promise<BackdropPrefs> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    return parsePrefs(settings)
  } catch {
    return parsePrefs(undefined)
  }
}

async function init(): Promise<void> {
  let prefs = await readPrefs()
  let stopBackdrop: (() => void) | null = null
  const renderBackdrop = (): void => {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const variant = backdropVariant(prefs.appearance, prefersLight)
    const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motion = !(prefs.reduceMotion || systemReduce)
    stopBackdrop?.()
    stopBackdrop = resolveBackdrop(prefs.backdrop).mount(document.body, {
      variant, motion, speed: prefs.backdropSpeed, darkenPhotos: prefs.darkenPhotos,
    })
  }
  renderBackdrop()
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.settings) return
    prefs = parsePrefs(changes.settings.newValue)
    renderBackdrop()
  })
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', renderBackdrop)
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', renderBackdrop)

  // Inject the palette content-script bundle; it reads window.__scPageMode and
  // auto-opens itself as the page.
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL('palette.js')
  document.head.appendChild(s)
}

void init()

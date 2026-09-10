import { backdropVariant, mountBackdrop } from './features/newtab/backdrop'

// Set before palette.js is injected so it opens the menu immediately as the page.
// (Inline <script> can't do this — MV3 extension-page CSP blocks inline code.)
;(window as unknown as { __scPageMode?: boolean }).__scPageMode = true

async function readPrefs(): Promise<{
  appearance: 'system' | 'light' | 'dark'
  reduceMotion: boolean
}> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    return {
      appearance: settings?.appearance ?? 'system',
      reduceMotion: settings?.reduceMotion === true,
    }
  } catch {
    return { appearance: 'system', reduceMotion: false }
  }
}

async function init(): Promise<void> {
  const prefs = await readPrefs()
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  const variant = backdropVariant(prefs.appearance, prefersLight)
  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const motion = !(prefs.reduceMotion || systemReduce)

  mountBackdrop(document.body, { variant, motion })

  // Inject the palette content-script bundle; it reads window.__scPageMode and
  // auto-opens itself as the page.
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL('palette.js')
  document.head.appendChild(s)
}

void init()

import {
  DEFAULT_QUICKLINKS,
  cleanHost,
  parseQuicklinks,
  parseSnippets,
  preserveQuicklinkExtras,
  serializeQuicklinks,
  serializeSnippets,
} from './lib'
import type { Quicklink, Snippet } from './lib'
import { BACKDROPS } from './features/newtab/registry'
import { DEFAULT_BACKDROP_ID, normalizeBackdropId } from './features/newtab/backdrop-meta'
import { clampPaletteScale } from './core/settings'

interface UserSettings {
  glassOpacity: number
  paletteScale: number
  iconColors: { command: string; folder: string; history: string; fallback: string }
  frecencyDecayDays: number
  defaultMode: 'bookmarks' | 'commands' | 'tabs' | 'history'
  appearance: 'system' | 'dark' | 'light'
  backdrop: string
  backdropSpeed: number
  darkenPhotos: boolean
  openInNewTab: boolean
  reduceMotion: boolean
  disabledSites: string[]
  quicklinks: Quicklink[]
  snippets: Snippet[]
}

const DEFAULTS: UserSettings = {
  glassOpacity: 0.8,
  paletteScale: 1,
  iconColors: { command: '#4c9df3', folder: '#e0a63c', history: '#9a6ee8', fallback: '#e05d5d' },
  frecencyDecayDays: 14,
  defaultMode: 'bookmarks',
  appearance: 'system',
  backdrop: DEFAULT_BACKDROP_ID,
  backdropSpeed: 1,
  darkenPhotos: true,
  openInNewTab: false,
  reduceMotion: false,
  disabledSites: [],
  quicklinks: DEFAULT_QUICKLINKS,
  snippets: [],
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const opacity = el<HTMLInputElement>('opacity')
const opacityValue = el<HTMLSpanElement>('opacity-value')
const paletteScale = el<HTMLInputElement>('palette-scale')
const paletteScaleValue = el<HTMLSpanElement>('palette-scale-value')
const colorCommand = el<HTMLInputElement>('color-command')
const colorHistory = el<HTMLInputElement>('color-history')
const colorFallback = el<HTMLInputElement>('color-fallback')
const defaultMode = el<HTMLSelectElement>('default-mode')
const appearance = el<HTMLSelectElement>('appearance')
const backdropGrid = el<HTMLDivElement>('backdrop-grid')
const darkenPhotos = el<HTMLInputElement>('darken-photos')
const newTab = el<HTMLInputElement>('new-tab')
const reduceMotion = el<HTMLInputElement>('reduce-motion')
const decay = el<HTMLInputElement>('decay')
const sites = el<HTMLTextAreaElement>('sites')
const quicklinks = el<HTMLTextAreaElement>('quicklinks')
const snippets = el<HTMLTextAreaElement>('snippets')
const status = el<HTMLSpanElement>('status')

function applyAppearance(mode: UserSettings['appearance']): void {
  const light =
    mode === 'light' ||
    (mode !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches)
  document.body.classList.toggle('light', light)
}

let selectedBackdrop = DEFAULTS.backdrop
// The palette settings own the speed control; carry the value so saving here
// (the secondary options page) doesn't reset it, and previews reflect it.
let loadedBackdropSpeed = DEFAULTS.backdropSpeed
let previewStops: Array<() => void> = []

/** Backdrop preview thumbnails follow the live appearance + reduce-motion state. */
function renderBackdropGrid(): void {
  for (const stop of previewStops) stop()
  previewStops = []
  backdropGrid.textContent = ''

  const mode = (appearance.value as UserSettings['appearance']) || 'system'
  const light =
    mode === 'light' ||
    (mode !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches)
  const variant = light ? 'light' : 'dark'
  for (const def of BACKDROPS) {
    const group = def.id === 'mountain-river' ? 'Landscapes'
      : def.id === 'liquid-ribbons' ? 'Abstract' : null
    if (group) {
      const heading = document.createElement('div')
      heading.className = 'bd-group'
      heading.textContent = group
      backdropGrid.appendChild(heading)
    }
    const thumb = document.createElement('button')
    thumb.type = 'button'
    thumb.className = `bd-thumb${def.id === selectedBackdrop ? ' selected' : ''}`
    thumb.dataset.id = def.id

    const preview = document.createElement('div')
    preview.className = 'bd-preview'
    const name = document.createElement('span')
    name.className = 'bd-name'
    name.textContent = def.label
    thumb.append(preview, name)
    backdropGrid.appendChild(thumb)

    // Mount after the preview is in the DOM so it has measurable dimensions.
    previewStops.push(
      def.mount(preview, {
        variant,
        motion: false,
        hideMark: true,
        contained: true,
        speed: loadedBackdropSpeed,
        darkenPhotos: darkenPhotos.checked,
      }),
    )

    thumb.addEventListener('click', () => {
      selectedBackdrop = def.id
      for (const t of backdropGrid.querySelectorAll('.bd-thumb')) {
        t.classList.toggle('selected', (t as HTMLElement).dataset.id === selectedBackdrop)
      }
      save()
    })
  }
}

/** Colors/icons aren't in the textarea format; keep the loaded set to re-attach on save. */
let loadedQuicklinks: Quicklink[] = []

function populate(s: UserSettings): void {
  loadedQuicklinks = s.quicklinks
  opacity.value = String(s.glassOpacity)
  opacityValue.textContent = `${Math.round(s.glassOpacity * 100)}%`
  paletteScale.value = String(clampPaletteScale(s.paletteScale))
  paletteScaleValue.textContent = `${Math.round(clampPaletteScale(s.paletteScale) * 100)}%`
  colorCommand.value = s.iconColors.command
  colorHistory.value = s.iconColors.history
  colorFallback.value = s.iconColors.fallback
  defaultMode.value = s.defaultMode
  appearance.value = s.appearance
  applyAppearance(s.appearance)
  selectedBackdrop = normalizeBackdropId(s.backdrop)
  loadedBackdropSpeed = s.backdropSpeed
  darkenPhotos.checked = s.darkenPhotos
  renderBackdropGrid()
  newTab.checked = s.openInNewTab
  reduceMotion.checked = s.reduceMotion
  decay.value = String(s.frecencyDecayDays)
  sites.value = s.disabledSites.join('\n')
  quicklinks.value = serializeQuicklinks(s.quicklinks)
  snippets.value = serializeSnippets(s.snippets)
}

function collect(): UserSettings {
  return {
    glassOpacity: Math.min(1, Math.max(0.4, Number(opacity.value) || DEFAULTS.glassOpacity)),
    paletteScale: clampPaletteScale(paletteScale.value),
    // Folder tiles no longer take a color (filled blue folder icon instead);
    // the stored key stays for settings-shape compatibility.
    iconColors: {
      command: colorCommand.value,
      folder: DEFAULTS.iconColors.folder,
      history: colorHistory.value,
      fallback: colorFallback.value,
    },
    frecencyDecayDays: Math.min(90, Math.max(1, Number(decay.value) || DEFAULTS.frecencyDecayDays)),
    defaultMode: (defaultMode.value as UserSettings['defaultMode']) || 'bookmarks',
    appearance: (appearance.value as UserSettings['appearance']) || 'system',
    backdrop: selectedBackdrop,
    backdropSpeed: loadedBackdropSpeed,
    darkenPhotos: darkenPhotos.checked,
    openInNewTab: newTab.checked,
    reduceMotion: reduceMotion.checked,
    disabledSites: sites.value.split('\n').map(cleanHost).filter(Boolean),
    quicklinks: preserveQuicklinkExtras(parseQuicklinks(quicklinks.value), loadedQuicklinks),
    snippets: parseSnippets(snippets.value),
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let statusTimer: ReturnType<typeof setTimeout> | undefined

function save(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const settings = collect()
    opacityValue.textContent = `${Math.round(settings.glassOpacity * 100)}%`
    paletteScaleValue.textContent = `${Math.round(settings.paletteScale * 100)}%`
    applyAppearance(settings.appearance)
    void chrome.storage.sync.set({ settings }).then(() => {
      status.classList.add('show')
      clearTimeout(statusTimer)
      statusTimer = setTimeout(() => status.classList.remove('show'), 1200)
    })
  }, 200)
}

for (const input of [opacity, paletteScale, colorCommand, colorHistory, colorFallback, defaultMode, appearance, darkenPhotos, newTab, reduceMotion, decay, sites, quicklinks, snippets]) {
  input.addEventListener('input', save)
  input.addEventListener('change', save)
}

// Previews depend on the theme + motion settings, so rebuild them live.
for (const input of [appearance, reduceMotion, darkenPhotos]) {
  input.addEventListener('change', renderBackdropGrid)
}

el<HTMLButtonElement>('reset').addEventListener('click', () => {
  populate(DEFAULTS)
  save()
})

async function boot(): Promise<void> {
  const { settings } = await chrome.storage.sync.get('settings')
  populate({
    ...DEFAULTS,
    ...settings,
    darkenPhotos: settings?.darkenPhotos !== false,
    iconColors: { ...DEFAULTS.iconColors, ...settings?.iconColors },
    quicklinks: settings?.quicklinks ?? DEFAULTS.quicklinks,
    snippets: settings?.snippets ?? DEFAULTS.snippets,
  })
}

void boot()

export {}

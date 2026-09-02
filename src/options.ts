import {
  DEFAULT_QUICKLINKS,
  cleanHost,
  parseQuicklinks,
  parseSnippets,
  serializeQuicklinks,
  serializeSnippets,
} from './lib'
import type { Quicklink, Snippet } from './lib'

interface UserSettings {
  glassOpacity: number
  iconColors: { command: string; folder: string; history: string; fallback: string }
  frecencyDecayDays: number
  defaultMode: 'bookmarks' | 'commands' | 'tabs' | 'history'
  appearance: 'system' | 'dark' | 'light'
  openInNewTab: boolean
  reduceMotion: boolean
  disabledSites: string[]
  quicklinks: Quicklink[]
  snippets: Snippet[]
}

const DEFAULTS: UserSettings = {
  glassOpacity: 0.8,
  iconColors: { command: '#4c9df3', folder: '#e0a63c', history: '#9a6ee8', fallback: '#e05d5d' },
  frecencyDecayDays: 14,
  defaultMode: 'bookmarks',
  appearance: 'system',
  openInNewTab: false,
  reduceMotion: false,
  disabledSites: [],
  quicklinks: DEFAULT_QUICKLINKS,
  snippets: [],
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const opacity = el<HTMLInputElement>('opacity')
const opacityValue = el<HTMLSpanElement>('opacity-value')
const colorCommand = el<HTMLInputElement>('color-command')
const colorHistory = el<HTMLInputElement>('color-history')
const colorFallback = el<HTMLInputElement>('color-fallback')
const defaultMode = el<HTMLSelectElement>('default-mode')
const appearance = el<HTMLSelectElement>('appearance')
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

function populate(s: UserSettings): void {
  opacity.value = String(s.glassOpacity)
  opacityValue.textContent = `${Math.round(s.glassOpacity * 100)}%`
  colorCommand.value = s.iconColors.command
  colorHistory.value = s.iconColors.history
  colorFallback.value = s.iconColors.fallback
  defaultMode.value = s.defaultMode
  appearance.value = s.appearance
  applyAppearance(s.appearance)
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
    openInNewTab: newTab.checked,
    reduceMotion: reduceMotion.checked,
    disabledSites: sites.value.split('\n').map(cleanHost).filter(Boolean),
    quicklinks: parseQuicklinks(quicklinks.value),
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
    applyAppearance(settings.appearance)
    void chrome.storage.sync.set({ settings }).then(() => {
      status.classList.add('show')
      clearTimeout(statusTimer)
      statusTimer = setTimeout(() => status.classList.remove('show'), 1200)
    })
  }, 200)
}

for (const input of [opacity, colorCommand, colorHistory, colorFallback, defaultMode, appearance, newTab, reduceMotion, decay, sites, quicklinks, snippets]) {
  input.addEventListener('input', save)
  input.addEventListener('change', save)
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
    iconColors: { ...DEFAULTS.iconColors, ...settings?.iconColors },
    quicklinks: settings?.quicklinks ?? DEFAULTS.quicklinks,
    snippets: settings?.snippets ?? DEFAULTS.snippets,
  })
}

void boot()

export {}

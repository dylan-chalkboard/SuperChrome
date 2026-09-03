/** Getting Started progress, stored in chrome.storage.sync. */

import type { OnboardState } from '../../features/onboarding'

let cache: OnboardState | null = null

export async function loadOnboarding(): Promise<OnboardState> {
  try {
    const { onboarding } = await chrome.storage.sync.get('onboarding')
    cache = onboarding && typeof onboarding === 'object' ? onboarding : { done: {} }
    cache!.done = cache!.done ?? {}
  } catch {
    cache = { done: {} }
  }
  return cache!
}

export function onboardingState(): OnboardState | null {
  return cache
}

/** Ticks a box; no-op (and no write) when already done. */
export async function markOnboard(key: string): Promise<void> {
  const state = cache ?? (await loadOnboarding())
  if (state.done[key]) return
  state.done[key] = true
  cache = state
  await chrome.storage.sync.set({ onboarding: state }).catch(() => {})
}

export async function dismissOnboarding(): Promise<void> {
  const state = cache ?? (await loadOnboarding())
  state.dismissed = true
  cache = state
  await chrome.storage.sync.set({ onboarding: state }).catch(() => {})
}

/** `>SuperChrome: Getting Started` brings a hidden checklist back. */
export async function reviveOnboarding(): Promise<void> {
  const state = cache ?? (await loadOnboarding())
  state.dismissed = false
  cache = state
  await chrome.storage.sync.set({ onboarding: state }).catch(() => {})
}

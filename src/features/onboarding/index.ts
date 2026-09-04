/**
 * Getting Started checklist (Raycast-walkthrough style): rows on the home
 * view that check off as features get used, gone once complete or dismissed.
 */

export interface OnboardStep {
  key: string
  label: string
}

export const ONBOARD_STEPS: OnboardStep[] = [
  { key: 'hotkey', label: 'Bind the ⌘P hotkey' },
  { key: 'command', label: 'Run a command with >' },
  { key: 'tab', label: 'Switch to a tab with @' },
  { key: 'actions', label: 'Open the actions menu with ⌘K' },
  { key: 'save', label: 'Save a bookmark with ⌘D' },
  { key: 'favorite', label: 'Add a favorite' },
  { key: 'library', label: 'Browse your bookmarks with *' },
  { key: 'quicklink', label: 'Create a quicklink' },
]

export interface OnboardState {
  done: Record<string, boolean>
  dismissed?: boolean
}

export function onboardProgress(state: OnboardState): number {
  return ONBOARD_STEPS.filter((s) => state.done[s.key]).length
}

export function onboardComplete(state: OnboardState): boolean {
  return ONBOARD_STEPS.every((s) => state.done[s.key])
}

/** Rows are shown until every box is ticked or the user hides the section. */
export function onboardVisible(state: OnboardState): boolean {
  return !state.dismissed && !onboardComplete(state)
}

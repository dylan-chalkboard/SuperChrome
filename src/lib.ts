/**
 * Barrel over the feature modules. Prefer importing from the feature folder
 * directly (src/features/<feature>) in new code; this exists so long-lived
 * imports and the test suite keep one stable path.
 */
export * from './features/ranking'
export * from './features/calculator'
export * from './features/quicklinks'
export * from './features/snippets'
export * from './features/navigation'
export * from './features/downloads'
export * from './features/gradients'
export * from './features/bookmarks'

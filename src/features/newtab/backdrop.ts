// Backdrops moved to backdrop-core.ts (shared harness) + backdrops/* (one per
// animation), selected via registry.ts. This barrel preserves the original
// import surface for `backdropVariant`/`dotInk` and the default mount.
export { backdropVariant, dotInk, BACKDROP_CSS } from './backdrop-core'
export type { BackdropVariant, BackdropOpts } from './backdrop-core'
export { mountDots as mountBackdrop } from './backdrops/dots'

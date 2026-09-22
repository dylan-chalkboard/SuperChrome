# Atmospheric New Tab Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ten similar effects with six cinematic animated backgrounds plus None.

**Architecture:** Keep the existing `mount/stop` registry contract. Bundle four compressed landscape images locally and render them through a shared DOM scene mount with slow transform/opacity layers. Add a distinct fluid canvas scene and a restrained abstract DOM scene. Reuse the existing picker and settings flow.

**Tech Stack:** TypeScript, Vite, Chrome MV3, CSS, Canvas 2D, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-atmospheric-newtab-backgrounds-design.md`

## Global Constraints

- No network request on new tab.
- Reduced motion shows a deliberate static frame.
- Pause scene motion in hidden tabs.
- Preserve `backdrop`, `backdropSpeed`, `reduceMotion`, and `appearance` settings.
- Existing saved IDs must resolve safely to the new default.
- Keep all generated images in the repository with creation notes.

---

### Task 1: Asset and Scene Harness

**Files:** Create `public/backgrounds/*.webp`, `src/features/newtab/backdrops/landscape.ts`, and `public/backgrounds/README.md`; modify `src/features/newtab/backdrop-core.ts` only if needed.

**Interfaces:** `mountLandscape(scene: LandscapeScene): MountFn`; each scene gives `id`, `src`, `base`, `mist`, and `light` colors.

- [x] Generate four wide photographic scenes and convert them to compressed local WebP files.
- [x] Build the shared mount with a fixed/contained root, image, overlays, hidden-tab pause, reduced-motion static state, speed scaling, and cleanup.
- [x] Verify each source file exists and the mount is type correct.

### Task 2: Fluid and Quiet Abstract

**Files:** Create `src/features/newtab/backdrops/fluid.ts` and `src/features/newtab/backdrops/quiet.ts`.

**Interfaces:** Export `mountFluid: MountFn` and `mountQuiet: MountFn`.

- [x] Implement dark, soft fluid folds with slow animation and static reduced-motion frame.
- [x] Implement a simpler low-detail atmospheric scene with the same mount contract.
- [x] Verify typecheck and inspect static composition.

### Task 3: Registry, Picker, and Migration

**Files:** Modify `src/features/newtab/backdrop-meta.ts`, `src/features/newtab/registry.ts`, `src/features/newtab/registry.test.ts`, `src/options.ts`, and optionally `options.html`.

**Interfaces:** Keep `BACKDROPS`, `DEFAULT_BACKDROP_ID`, and `resolveBackdrop(id)` public API.

- [x] Update registry tests for the seven new IDs, uniqueness, and legacy fallback.
- [x] Change registry and metadata; set Mountain river as default.
- [x] Make picker previews static to avoid seven simultaneous animations and keep selection keyboard accessible.
- [x] Update defaults and legacy fallback in the new-tab and settings flows.
- [x] Run relevant Vitest tests and typecheck.

### Task 4: Final Verification

**Files:** Modify `README.md` only if user-visible backdrop documentation needs updating.

- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Check asset sizes and inspect generated assets; browser access to the extension is blocked by the browser policy.
- [x] Run `git diff --check`, review changed files, and report any remaining limitations.

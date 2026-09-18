# Atmospheric New Tab Backgrounds — Design

**Date:** 2026-09-18  
**Status:** Approved direction; implementation pending

## Goal

Replace the current collection of similar abstract effects with a smaller,
distinct set of cinematic backgrounds. Opening a tab should feel atmospheric
and alive while the search palette remains easy to read. The mountain and river
concept chosen in conversation is the visual benchmark: natural detail, deep
shadows, soft haze, and restrained highlights. The supplied dark green fluid
image is the reference for the abstract scene's soft, organic motion.

## Collection

Six animated choices plus **None**:

1. **Mountain river** (default): a dramatic valley, river and drifting mist.
2. **Misty coast**: cliffs, water and slow cloud movement in cool slate tones.
3. **Desert light**: layered dunes or rock forms with warm, changing light.
4. **Forest dusk**: wooded depth, atmospheric haze and sparse light movement.
5. **Fluid**: dark, velvety color folds flowing slowly; palette can differ from
   green, but the supplied reference sets its texture and pace.
6. **Quiet abstract**: a simpler, low-detail atmospheric option for users who
   want less visual activity.
7. **None**: a static theme-aware background.

Each scene gets its own palette; the collection is not limited to green. The
landscapes should look photographic and cinematic, not painterly or illustrative.

## Rendering and motion

Generate local still assets for the four landscapes. Package them with the
extension; opening a tab must require no network request. Build a small shared
scene renderer around the existing backdrop `mount/stop` interface. A scene
contains a base image, a legibility overlay and at most a few translucent
motion layers. Motion is very slow and limited to mist, light, subtle water
glints or slight parallax. It must not visibly warp mountains, trees or terrain.
Fluid and Quiet abstract can use code-rendered layers where that produces
smoother motion and smaller assets. Avoid full-screen video loops: they add
considerable package size and decoding work for every new tab.

The search palette area remains dark or subdued enough for contrast. Motion
pauses when the tab is hidden and resumes when visible. When user or system
reduced motion is active, every scene renders a deliberate static frame.
Backdrop speed continues to affect animated scenes without changing their
base composition. Animations should use transforms and opacity where possible;
canvas work should avoid expensive full-resolution redraws.

## Integration

Keep `src/features/newtab/registry.ts` as the source of truth for choices and
reuse each scene's `mount` in both the new tab and options previews. Replace the
old ten-effect picker with the new collection. Keep existing setting shape
(`backdrop`, `backdropSpeed`, `reduceMotion`, `appearance`) and the existing
save behavior. Older saved backdrop IDs should resolve to the new default
rather than break the page. **None** remains selectable.

Scenes can use the same imagery in light and dark appearance modes; appearance
continues to control the palette UI, while the scene renderer applies whatever
overlay is needed to keep its content legible. Thumbnails show the actual scene
at reduced size and can use static frames to avoid running seven animations in
the options page simultaneously. Selection remains keyboard accessible.

## Assets and quality bar

Use the approved mountain-river concept as a direction reference rather than
shipping that brainstorming image without review. Generate and inspect final
assets at a wide desktop aspect ratio; verify useful crops on narrower windows.
Compress assets so the extension remains practical to install and new tabs
appear immediately. Provide a matching color fallback while images decode.
Keep generated assets and attribution/creation notes in the repo.

## Verification

- Registry tests cover unique IDs, labels, mounts and fallback of old/unknown
  IDs.
- Check reduced motion, hidden-tab pause/resume, speed, theme appearance,
  picker selection, and teardown/re-mount behavior.
- Build and typecheck; inspect full-size new tabs and preview crops in the
  browser at desktop and narrow widths.
- Compare package size and new-tab render time with the current build, then
  adjust image compression or animation work if the increase is noticeable.

## Scope boundary

No user uploads, remote image feeds, full simulation engine or video downloads.
The goal is a cohesive built-in collection, not a background marketplace.

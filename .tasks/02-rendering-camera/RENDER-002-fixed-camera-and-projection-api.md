# RENDER-002 — Lock the camera and expose projection conversions

- **Priority:** P0
- **Depends on:** RENDER-001
- **Touches:** `src/game/rendering/IsometricCamera.js`, `src/utils/IsometricProjection.js`, `src/game/VoxelRenderer.js`, `src/game/GameControls.js`

## Goal

Provide one fixed isometric three-quarter play view and reliable conversions for entities, selection, collision feedback, and debug tools.

## Work

- Consolidate projection math now split between `VoxelRenderer` fields and `IsometricProjection.js`.
- Expose grid/world/elevation-to-screen and screen-to-ground APIs, including viewport scale and offset.
- Compute one responsive framing that keeps the generated island, castle, HUD-safe areas, and hero play space visible.
- Lock rotation, pan, and zoom for normal play; keep optional developer inspection state outside gameplay state.
- Define whether screen-to-ground selects the topmost walkable cell when multiple heights overlap.
- Recalculate framing on resize without resetting the active level or simulation.

## Acceptance criteria

- A world point projects identically for terrain, hero, enemies, towers, targeting, and effects.
- Normal input never changes camera state during a wave.
- Common desktop and mobile aspect ratios show the relevant island without clipping the castle or active gates.
- Developer camera changes do not alter movement directions, route topology, ranges, or saved seed results.

## Verification

- Add projection round-trip fixtures at all four debug rotations and fixed-play-view responsive screenshots.


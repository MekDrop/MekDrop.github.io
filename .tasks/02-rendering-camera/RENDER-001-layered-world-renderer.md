# RENDER-001 — Split the world renderer into stable layers

- **Priority:** P0
- **Depends on:** FOUNDATION-003, WORLD-001
- **Touches:** `src/game/VoxelRenderer.js`, `src/game/rendering/`, `src/components/GameCanvas.vue`

## Goal

Refactor the current single-`Graphics` redraw into a scene graph that supports static terrain and frequently changing gameplay entities efficiently.

## Work

- Keep one primary class per file and split projection, terrain, structures, entities, projectiles/effects, debug overlays, and selection indicators into dedicated render components.
- Establish sibling `Container` layers with explicit sorting/render order; use a render group for the mostly static world when profiling supports it.
- Build static terrain/structure geometry once per level and avoid rebuilding it when HP, waves, hero position, or tower targeting changes.
- Keep PixiJS leaf objects childless; wrap composite actors in `Container` nodes.
- Add renderer lifecycle methods for mount, level load, snapshot update, resize, and destroy.
- Preserve current bridge handling, debug arrows, viewport preservation for debug mode, and screenshot extraction.

## Acceptance criteria

- Moving one enemy does not recreate terrain `Graphics` or all tile geometry.
- Restarting a level destroys or reuses all old layer contents with no orphaned display objects.
- Static/dynamic layer order is documented and castle/towers/entities occlude consistently.
- Debug overlays can toggle without regenerating terrain.

## Verification

- Add renderer smoke tests around layer creation, update isolation, level replacement, and destroy.


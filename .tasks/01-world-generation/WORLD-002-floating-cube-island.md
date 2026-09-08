# WORLD-002 — Generate a true floating cube island

- **Priority:** P1
- **Depends on:** WORLD-001
- **Touches:** `src/game/MapGenerator.js`, `src/game/map/IslandGenerator.js`, `docs/map-generator-rules.md`

## Goal

Turn the current surface mask over water into one connected chunk of earth floating in a sky void.

## Work

- Generate one connected playable surface with varied but coherent footprint and castle placement.
- Generate surface heights as plateaus/terraces rather than isolated noise; all required walking/build cells remain usable.
- Generate underside columns separately from the surface, tapering downward in connected cube clusters without detached playable blocks.
- Use one identical cube unit for every earth block on the surface, cliffs, and underside; create larger masses only by combining those cubes, never by stretching geometry.
- Reserve clear boundary gates and sufficient land around the castle, routes, pipes, and build pads.
- Keep optional ponds/streams as true water objects on the island rather than using water for empty sky.
- Emit decorative underside-only blocks/crystals separately so they never affect pathfinding or buildability.

## Acceptance criteria

- No visible full water plane exists under the level unless deliberately configured as a distant cosmetic layer.
- Every playable cell belongs to one connected island; no route, castle tile, pipe, or build pad floats separately.
- Regeneration yields materially different silhouettes and massing while remaining valid.
- Surface and underside geometry remain grid-aligned cube assemblies in the same isometric projection.
- Terrain cubes have identical modeled width, depth, and block-height units everywhere.

## Verification

- Validate connectivity and render a fixed seed from each of at least five silhouette families.

# WORLD-001 — Extend the map schema and add seeded generation

- **Priority:** P0
- **Depends on:** FOUNDATION-001, FOUNDATION-003
- **Touches:** `src/game/MapGenerator.js`, `src/game/map/`, `docs/map-generator-rules.md`

## Goal

Produce a reproducible level document rich enough for simulation rather than only a renderable tile grid.

## Work

- Replace direct `Math.random()` calls with an injected seeded random source and return the seed in level metadata.
- Separate `VOID`/sky from actual water so off-island space is not rendered as an ocean floor.
- Extend tile/object data with walkability, buildability, occupied/reserved owner, height/shape/direction, and stable IDs.
- Add explicit collections for routes, gates/spawns, castle target/attack cells, pipe endpoints, build pads, water, decorations, and underside blocks.
- Keep generated output serializable; convert runtime Sets/Maps at the session boundary if needed.
- Add a schema version so saved debug seeds remain diagnosable after generator changes.

## Acceptance criteria

- The same seed and options produce byte-equivalent normalized level data.
- Different seeds demonstrably vary island footprint, castle placement, routes, and usable build locations.
- Every grid cell has exactly one primary surface type and optional object occupancy, never a combined path/grass tile.
- The schema distinguishes static generation data from runtime tower/enemy state.

## Verification

- Snapshot at least three fixed seeds and add a serialization round-trip test.


# WORLD-006 — Complete generation validation and bounded retry

- **Priority:** P0
- **Depends on:** WORLD-002, WORLD-003, WORLD-004, WORLD-005
- **Touches:** `src/game/MapGenerator.js`, `src/game/map/MapValidator.js`, `docs/map-generator-rules.md`

## Goal

Reject unplayable levels before rendering and recover predictably when a random attempt fails.

## Work

- Extract validation into a cohesive validator that returns structured diagnostics while generation may still throw a concise final error.
- Implement every required rule in `docs/map-generator-rules.md`, including projection metadata, tile ownership, path width, turn/elevation discipline, gate placement, merge rules, water/waterfall rules when enabled, tree/build reservations, island connectivity, and variety.
- Add gameplay validators for identical path/grass grid projection and full-cell footprint, exact two-tile cross-section at straights/turns/merges/intersections/castle approaches/pipe interfaces, rejection of widened three-/four-tile road areas, full-width gate-to-path adjacency, ownership of every path tile by a gate-to-castle traversal, rejection of disconnected/orphan/dead-end decorative roads, ordered route termination, quickest-route reachability, pipe pairing/no loops, pipes never occupying main-path cells, direct full-width path-facing pipe interfaces, optional connectors staying orthogonal and exactly two tiles wide, pipe mouths facing the route at ground level, rejection of half-pipe/cutaway/cubist render metadata, uniform terrain-cube dimensions, hero reachability, minimum build economy, castle attack cells, spawn safety, and path-count maximum.
- Add a bounded deterministic retry strategy derived from the requested seed and expose attempt count/diagnostics in debug metadata.
- Score route length, build coverage, path concurrency, and castle travel time against difficulty bounds.
- Fail loudly after the retry budget rather than rendering a partially valid map.

## Acceptance criteria

- Invalid maps never reach `VoxelRenderer` or `GameSession`.
- Retrying the same seed/options selects the same successful attempt.
- Failure messages identify the violated invariant and relevant cells/route IDs.
- Generation completes within an agreed desktop/mobile time budget for at least 99% of sampled seeds.

## Verification

- Add targeted invalid fixtures for every validator family plus a seeded stress run.

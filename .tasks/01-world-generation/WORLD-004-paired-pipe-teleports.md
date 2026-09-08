# WORLD-004 — Generate paired pipe teleports

- **Priority:** P1
- **Depends on:** WORLD-003
- **Touches:** `src/game/MapGenerator.js`, `src/game/map/PipeGenerator.js`, `src/game/map/RouteGraph.js`, `docs/map-generator-rules.md`

## Goal

Make pipes structural, paired route teleports rather than decoration or an empty `pipeData` placeholder.

## Work

- Define directed pipe endpoints with stable pair IDs, entry direction, exit direction, elevation, route-segment references, and traversal cost used by quickest-path selection.
- Select only reserved grass positions beside a straight path section with enough clearance for a direct two-lane pipe interface.
- Keep every pipe footprint off the main path. Make each ground-level mouth face and directly abut the adjacent two-tile route; entering endpoint A continues at endpoint B without a hidden disconnected edge.
- If connector cells are required, use a predefined short orthogonal two-lane template that preserves an exact two-tile cross-section and never creates a widened three-/four-tile road pad.
- Decide pair directionality explicitly. Default to one-way for enemies; allow symmetric pairs only when both directions are valid.
- Make each pipe mouth span both interface lanes at enemy ground level. Use a complete elbow/side-facing cylinder aimed directly toward the route—not an upward-only opening—so enemies visibly walk straight into the entrance and out of the paired exit.
- Give endpoints a recognizable complete smooth round green cylindrical body with a full circular opening and wide flared rim; pipes are an explicit exception to cube-built terrain. Half-pipes, cutaway tunnel shells, arches, and cubist substitutes are forbidden. Use pair-colored bands/emblems so matching endpoints remain obvious.
- Keep this pipe silhouette exclusive to teleports. Boundary entry gates remain fortified arches and no gate-shaped structure may appear mid-route.
- Reserve each complete pipe footprint and prevent overlap with gates, turns, merges, bridges, castle, water, towers, and other pipes.
- Validate that a pipe cannot loop an enemy indefinitely or bypass the castle terminal.

## Acceptance criteria

- Every pipe endpoint belongs to exactly one valid pair and one route transition.
- Every pipe occupies reserved non-path grass cells and has exactly one direct full-width interface with the main path graph.
- Any connector terminates only at its pipe mouth and becomes a valid gate-to-castle graph transition through the paired endpoint; it cannot exist as an unused or decorative dead end.
- Route progress remains monotonic across teleportation and the exit facing is deterministic.
- Enemies can enter and leave through the center of both lanes without intersecting pipe walls or stepping off path tiles.
- Pipe facing matches the path-interface direction exactly, and the route sampler reaches the mouth center at ground height.
- Paired pipe visuals occupy reserved cells beside the path—never over it—without violating two-lane continuity.
- Every rendered pipe is a complete cylindrical/elbow pipe with a full flared circular rim, never a half-pipe.
- Seeds without enough safe space omit pipes instead of forcing invalid placement.

## Verification

- Test no-pipe, one-pair, multiple independent pairs, malformed/unpaired data rejection, and no-loop validation.

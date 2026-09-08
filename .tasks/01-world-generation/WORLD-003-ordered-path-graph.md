# WORLD-003 — Generate ordered paths for one to four routes

- **Priority:** P0
- **Depends on:** WORLD-001
- **Touches:** `src/game/MapGenerator.js`, `src/game/map/PathGenerator.js`, `src/game/map/RouteGraph.js`, `docs/map-generator-rules.md`

## Goal

Replace unordered occupied-cell sets with traversal-ready route graphs while preserving the map specification.

## Work

- Generate one to four entry routes, each exactly two full tiles wide, using only north/east/south/west movement and 90-degree turn templates.
- Keep path cells on the exact terrain grid: their top-face corners, projection axes, scale, elevation footprint, and rotation must match adjacent grass cells one-for-one.
- Enforce width by cross-section, including at corners, intersections, joins, merge zones, and the shared trunk. A merge reuses the same two-lane trunk cells and must never form a three-/four-tile-wide plaza or crossing.
- Support boundary gates on all viable island sides and more than one branch-specific merge location.
- Make every boundary gate occupy both route lanes across the full two-tile width, followed immediately by two connected path tiles with no obstruction or narrowing.
- Emit ordered centerline/waypoint segments and lane ownership from every spawn through merges to the castle attack point.
- Store weighted graph edges and precomputed/queriable remaining costs so an enemy can choose the quickest valid path at spawn and every junction without leaving the path graph.
- Emit a reverse shortest-path successor/direction field rooted at the castle, covering the complete route from every gate; arrow metadata must never point outward, backward, or toward a non-optimal branch.
- Keep at least two complete grass cells between parallel path bands outside explicit merge zones; this satisfies the user's at-least-one request and the repository's stricter rule.
- Enforce compatible elevation/direction/lane alignment at merges and forbid re-splitting after merge.
- Include the shared trunk in every route or reference a shared immutable graph segment so enemies never need to infer topology from colored tiles.
- Reject every path tile that is not reachable from a boundary gate and unable to reach the castle. Do not emit decorative roads, disconnected fragments, loops, or dead-end branches; only validated pipe connector spurs may terminate away from the castle.
- Preserve straight two-tile-wide bridges where routes cross water.

## Acceptance criteria

- `route.sample(progress)` or an equivalent API returns an unambiguous world position and facing from spawn to castle.
- Every traversable route cell has an arrow direction whose successor decreases remaining quickest-path cost until the castle terminal.
- Every active gate maps to exactly one valid initial segment and every terminal segment maps to the castle.
- Every gate opening fills both lanes, and its inside edge is fully adjacent to the first two path cells.
- Turns occupy complete tiles without diagonals, narrow wedges, or lane collapse.
- Rendering metadata cannot describe a top-down rectangular road, differently rotated face, or floating strip over grass; path ownership replaces the complete base cell.
- No connected road region has a perpendicular cross-section wider or narrower than two tiles outside the minimal predefined two-lane turn/merge template.
- Generation never exceeds four active entry routes.
- Every rendered path cell is owned by the validated route graph and participates in a gate-to-castle traversal or a paired-pipe transition.

## Verification

- Test one-, two-, three-, and four-route seeds, every gate side, consecutive turns, merges, and bridge traversal.

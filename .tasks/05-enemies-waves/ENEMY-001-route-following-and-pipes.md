# ENEMY-001 — Follow ordered routes and pipe transitions

- **Priority:** P0
- **Depends on:** FOUNDATION-002, WORLD-003, WORLD-004
- **Touches:** `src/game/entities/Enemy.js`, `src/game/systems/EnemyMovementSystem.js`, `src/game/map/RouteGraph.js`

## Goal

Move enemies reliably from any active gate through turns, merges, bridges, and pipes to the castle.

## Work

- Represent enemy graph position as edge/segment ID plus monotonic distance/progress rather than inferring movement from tile colors.
- At spawn and every junction, select the quickest valid remaining graph route to the castle using deterministic weighted shortest-path cost; consider only existing path and pipe-transition edges.
- Sample world position, height, and facing along orthogonal segment centerlines while keeping the two-tile path visually intact.
- Handle segment transitions, shared merges, and castle attack-zone arrival deterministically.
- Treat a pipe's side connector as an optional weighted graph branch; take it only when its total remaining travel cost is the quickest valid route to the castle.
- Add pipe enter delay/animation state, instant graph transition, exit delay/invulnerability policy, and continued route progress.
- Prevent collisions or local avoidance from pushing enemies off valid routes; decide whether enemies may overlap or use lightweight lane offsets.
- Expose normalized quickest remaining travel cost for tower targeting modes.

## Acceptance criteria

- Every spawned enemy reaches the castle attack zone unless killed, with no corner cutting or route guessing.
- Enemies cannot reverse, select an unrelated branch, loop through pipes, or skip a required terminal segment.
- Given the same graph state and enemy movement traits, all enemies deterministically choose the quickest valid route; stable edge IDs break equal-cost ties.
- Route progress remains comparable after branches merge and across teleports.
- Movement distance is stable across simulation step rates and render FPS.

## Verification

- Test all turn directions, merges, bridge segments, every path count, pipe transitions, and very large frame-delay recovery.

# WORLD-005 — Generate build zones and safe object placement

- **Priority:** P0
- **Depends on:** WORLD-001, WORLD-003, WORLD-004
- **Touches:** `src/game/MapGenerator.js`, `src/game/map/PlacementPlanner.js`, `docs/map-generator-rules.md`

## Goal

Guarantee useful hero-accessible tower sites without corrupting routes or visual readability.

## Work

- Derive flat, green, unobstructed build pads with explicit tower footprint and hero interaction cells.
- Distribute pads along early, middle, and late route coverage; account for all active paths and pipe exits.
- Reserve hero spawn/respawn, castle perimeter, gates, merges, turns, bridges, pipe footprints, and route clearance before decorations.
- Emit reachable loot-spawn candidate cells on flat unreserved grass, separate from build pads and decoration cells.
- Place trees and cube decorations only after gameplay reservations and keep sight lines to gates, merges, pipes, towers, and castle open.
- Validate that each pad is reachable by the hero without crossing void, occupied structures, or enemy-only pipe transitions.
- Return coverage metadata useful for difficulty scoring, but do not guarantee one trivially dominant pad.

## Acceptance criteria

- Every level provides the configured minimum number of build pads and at least one viable early defense position.
- Pads are flat, grass-owned, unobstructed, and large enough for their declared tower footprint.
- Decorations never consume reserved cells or hide important route landmarks.
- Four-path maps provide strategically meaningful access to all entries before their final merge.

## Verification

- Run placement validation over a large seed sample and inspect representative low/high coverage layouts.

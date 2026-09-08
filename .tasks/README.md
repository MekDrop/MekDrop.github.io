# Super-Mario-inspired tower-defense roadmap

This backlog turns the current procedural isometric map viewer into a complete fixed-camera tower-defense game. Tasks are grouped by the subsystem they primarily touch; cross-cutting files are listed inside each task.

The intended aesthetic is an original, cube-built, cheerful platform-game homage. Do not copy Nintendo names, characters, artwork, music, sound effects, level layouts, or other protected assets. Pipes, brick-like forms, bright colors, jumping, and readable arcade feedback can provide the flavor without shipping a plumber-shaped lawsuit magnet.

## Product contract

- Each level is generated at runtime from a reproducible seed.
- The playable world is one connected floating earth island in a sky void. Terrain, paths, structures, pipes, towers, and decorations read as grid-aligned cubes or cube-built assemblies.
- A level has one to four enemy paths, and every path cross-section is exactly two tiles wide everywhere. Every boundary entry fills the complete two-tile width and immediately connects to a traversable full-width path. Turns, joins, merges, castle approaches, and pipe connectors may never widen into three- or four-tile roads. Paths use only 90-degree turns and eventually feed the castle without splitting after a merge.
- Parallel paths keep at least two complete grass tiles between them outside declared merge zones. This is stricter than the requested one-tile minimum and follows `docs/map-generator-rules.md`.
- Paired pipes are directed teleports placed on reserved grass beside, never on, the main path. Each complete smooth round pipe has a full cylindrical body and flared circular rim; half-pipes, cutaway tunnels, and cubist pipe substitutes are invalid. Its ground-level mouth directly faces and abuts a two-tile path interface; any required connector stays exactly two full orthogonal tiles wide without widening the route.
- Every enemy chooses the quickest valid remaining route to the castle using only generated path-graph edges, including weighted pipe transitions.
- Direction arrows form a continuous castle-rooted field from every gate: every arrow points along the quickest valid path toward the castle and never outward or randomly.
- Every normal path tile belongs to at least one continuous boundary-gate-to-castle route. No disconnected, decorative, orphaned, or dead-end road segments are generated; any connector cells terminate at valid paired pipes.
- Every terrain/earth voxel uses the same grid-unit width, depth, and block height; larger landforms are assemblies of those identical cubes.
- Path top faces use exactly the same isometric diamond/parallelogram projection, rotation, scale, and cell footprint as grass top faces. A path is a tile-material replacement, never a top-down rectangle or free-angle overlay.
- Reachable grass cells can receive deterministic random loot crates that the hero opens for configured resources; crates never block paths, structures, towers, or reserved build areas.
- The visible hero runs and jumps around the island under player control. Towers can be built only through the hero's nearby build interaction.
- The camera uses one fixed isometric three-quarter view during normal play. Pan, zoom, and quarter-turn rotation may remain as developer-only inspection tools.
- Waves can enter from every active route. Enemies that reach attack range damage the castle; the castle has explicit HP.
- Victory requires surviving every configured wave with castle HP above zero. Castle destruction is defeat.

## Current-state assessment (2026-09-02)

- `MapGenerator.js` already produces a connected 42x42 land mass, one to four two-tile-wide orthogonal paths, merges, boundary entries, a castle footprint, heights, bridge classification, and several validators.
- The generated `paths` contain sets of occupied cells rather than ordered movement routes, and the shared trunk is not represented as a complete per-entry waypoint sequence. `pipeData` exists but is always empty.
- Outside-island cells are currently `WATER`; there is no separate sky/void type or generated cube underside.
- `VoxelRenderer.js` redraws the complete map into one `Graphics` object. It has no persistent terrain/entity/effects/UI layers and no public world-to-screen conversion for moving actors.
- The uncommitted work adds input/action classes for pan, zoom, rotation, regeneration, debug arrows, and screenshots. It is clean under ESLint, but release camera movement conflicts with the fixed-camera requirement and must be developer-gated rather than casually discarded.
- Hero and enemy animation states, a sprite registry, `AssetsManager`, Yuka, and older shooter configuration exist but are not wired into `GameCanvas.vue` or the current voxel world.
- There is no game clock, session state, hero entity, enemy path following, tower placement, targeting, damage, currency, wave director, castle HP, win/loss flow, gameplay HUD, or gameplay test coverage.
- Existing Cypress coverage checks the surrounding personal-site shell only.

## Delivery sequence

1. **Playable spine:** FOUNDATION-001 through FOUNDATION-004, WORLD-001, RENDER-001/002, PLAYER-001/003, TOWER-001/002, ENEMY-001, WAVE-001, CASTLE-001, and UI-001.
2. **Procedural promise:** WORLD-002 through WORLD-006 and TEST-001.
3. **Game depth:** PLAYER-002/004, LOOT-001, TOWER-003/004, ENEMY-002/003, WAVE-002, and UI-002.
4. **Presentation and hardening:** RENDER-003/004, UI-003, TEST-002/003, PERF-001, and DOCS-001.

## Task index

### `00-foundation`

- [FOUNDATION-001](00-foundation/FOUNDATION-001-gameplay-contract-and-config.md) — Freeze gameplay contracts and data-driven configuration.
- [FOUNDATION-002](00-foundation/FOUNDATION-002-game-session-and-loop.md) — Add the session runtime and fixed-step game loop.
- [FOUNDATION-003](00-foundation/FOUNDATION-003-world-model-events-and-lifecycle.md) — Define world/entity events and lifecycle boundaries.
- [FOUNDATION-004](00-foundation/FOUNDATION-004-reconcile-current-control-work.md) — Reconcile the current camera/control work with fixed-camera play.

### `01-world-generation`

- [WORLD-001](01-world-generation/WORLD-001-map-schema-and-seeded-generation.md) — Extend the map schema and add seeded generation.
- [WORLD-002](01-world-generation/WORLD-002-floating-cube-island.md) — Generate a real sky island and cube underside.
- [WORLD-003](01-world-generation/WORLD-003-ordered-path-graph.md) — Produce ordered routes for one to four valid paths.
- [WORLD-004](01-world-generation/WORLD-004-paired-pipe-teleports.md) — Generate and validate paired pipe teleports.
- [WORLD-005](01-world-generation/WORLD-005-build-zones-and-object-placement.md) — Generate build zones and decoration reservations.
- [WORLD-006](01-world-generation/WORLD-006-generation-validation-and-retry.md) — Complete validation, retries, and difficulty checks.

### `02-rendering-camera`

- [RENDER-001](02-rendering-camera/RENDER-001-layered-world-renderer.md) — Split terrain and dynamic rendering into stable layers.
- [RENDER-002](02-rendering-camera/RENDER-002-fixed-camera-and-projection-api.md) — Lock the play camera and expose projection conversions.
- [RENDER-003](02-rendering-camera/RENDER-003-cube-built-art-kit.md) — Build the original cube-art visual kit.
- [RENDER-004](02-rendering-camera/RENDER-004-entity-depth-effects-and-feedback.md) — Render moving entities, depth, and effects correctly.

### `03-player-building`

- [PLAYER-001](03-player-building/PLAYER-001-hero-movement-and-collision.md) — Add hero movement, jumping, collision, and recovery.
- [PLAYER-002](03-player-building/PLAYER-002-hero-state-and-animation.md) — Integrate hero states, animation, and feedback.
- [PLAYER-003](03-player-building/PLAYER-003-build-interaction-and-targeting.md) — Let the hero select nearby build pads.
- [PLAYER-004](03-player-building/PLAYER-004-economy-construction-and-placement.md) — Implement costs, construction, refunds, and placement rules.
- [LOOT-001](03-player-building/LOOT-001-random-resource-crates.md) — Spawn reachable resource crates for the hero to open.

### `04-towers-combat`

- [TOWER-001](04-towers-combat/TOWER-001-tower-model-and-registry.md) — Define towers and a data-driven registry.
- [TOWER-002](04-towers-combat/TOWER-002-targeting-projectiles-and-damage.md) — Implement deterministic tower combat.
- [TOWER-003](04-towers-combat/TOWER-003-tower-roster-upgrades-and-selling.md) — Add tower roles, upgrades, and selling.
- [TOWER-004](04-towers-combat/TOWER-004-combat-feedback-and-balance.md) — Add readable feedback and tune the first balance pass.

### `05-enemies-waves`

- [ENEMY-001](05-enemies-waves/ENEMY-001-route-following-and-pipes.md) — Move enemies across ordered routes and pipes.
- [ENEMY-002](05-enemies-waves/ENEMY-002-enemy-model-and-roster.md) — Add enemy health, rewards, defenses, and archetypes.
- [ENEMY-003](05-enemies-waves/ENEMY-003-enemy-animation-and-pooling.md) — Integrate animation, pooling, and cleanup.
- [WAVE-001](05-enemies-waves/WAVE-001-wave-director-and-spawning.md) — Spawn waves fairly across active paths.
- [CASTLE-001](05-enemies-waves/CASTLE-001-castle-health-attacks-and-defeat.md) — Give the castle HP and enemy attack behavior.
- [WAVE-002](05-enemies-waves/WAVE-002-level-victory-progression-and-restart.md) — Resolve victory, defeat, progression, and restart.

### `06-ui`

- [UI-001](06-ui/UI-001-gameplay-hud.md) — Add the gameplay HUD and build prompt.
- [UI-002](06-ui/UI-002-level-flow-pause-and-onboarding.md) — Add start, pause, onboarding, and result flows.
- [UI-003](06-ui/UI-003-responsive-input-and-accessibility.md) — Support keyboard, touch/gamepad policy, and accessibility.

### `07-quality-docs`

- [TEST-001](07-quality-docs/TEST-001-generator-property-tests.md) — Property-test procedural generation.
- [TEST-002](07-quality-docs/TEST-002-headless-gameplay-simulation-tests.md) — Test combat and waves without rendering.
- [TEST-003](07-quality-docs/TEST-003-cypress-gameplay-journey.md) — Cover a deterministic playable journey in Cypress.
- [PERF-001](07-quality-docs/PERF-001-performance-lifecycle-and-ssr.md) — Meet performance, cleanup, and SSR requirements.
- [DOCS-001](07-quality-docs/DOCS-001-maintainer-docs-and-asset-licenses.md) — Document systems, tuning, controls, and asset provenance.

## Global definition of done

Every implementation task must preserve unrelated working-tree changes, follow modern JavaScript private fields, keep one primary class per system file, run `npm run lint`, and add proportionate automated coverage. Changes to generation or tile rendering must also update and comply with `docs/map-generator-rules.md`.

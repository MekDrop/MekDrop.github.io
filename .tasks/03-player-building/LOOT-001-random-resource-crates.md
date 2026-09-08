# LOOT-001 — Spawn random resource crates for hero collection

- **Priority:** P1
- **Depends on:** FOUNDATION-002, FOUNDATION-003, WORLD-005, PLAYER-003, PLAYER-004
- **Touches:** `src/game/entities/LootCrate.js`, `src/game/systems/LootSpawnSystem.js`, `src/game/systems/LootInteractionSystem.js`, `src/game/config/loot.js`, `src/game/rendering/LootCrateView.js`, `src/components/game/`

## Goal

Periodically place optional loot crates on safe parts of the island so exploration with the hero can provide extra resources.

## Work

- Define a data-driven loot table for configured resource bundles; initially support currency and leave additional resource types explicit rather than hard-coded.
- Use the session's deterministic RNG to choose spawn time, candidate cell, crate presentation, and contents so a seed/input replay remains reproducible.
- Spawn only on reachable, flat, unoccupied grass candidates emitted by map generation.
- Exclude paths, gates, pipe footprints, castle/attack cells, build pads, tower footprints, hero spawn/respawn, cliffs, water/void, trees, and other loot reservations.
- Limit active crates, apply optional lifetime/despawn warning, and prevent a new crate from trapping or overlapping the hero.
- Let the nearby hero highlight and open a crate through the shared interact control; award its contents atomically and publish resource/UI/effect events.
- Use original cube-built crate/chest visuals, not copyrighted question blocks or franchise symbols.

## Acceptance criteria

- Every spawned crate is reachable and can be opened without crossing void or entering a blocked footprint.
- The same seed and timed command sequence produces the same crate spawns and rewards.
- A crate never blocks enemy movement, a two-lane path, a pipe transition, tower construction, or castle access.
- Opening, despawning, restart, and disposal release the reservation exactly once and cannot duplicate rewards.
- HUD/world prompts show the resource contents or result clearly without adding audio requirements.

## Verification

- Test deterministic spawning, invalid-cell rejection, active-cap behavior, hero proximity, double-open protection, rewards, despawn, restart, and disposal.

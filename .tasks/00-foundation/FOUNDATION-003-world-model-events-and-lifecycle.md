# FOUNDATION-003 — Define world model, events, and lifecycle boundaries

- **Priority:** P0
- **Depends on:** FOUNDATION-001
- **Touches:** `src/game/core/`, `src/game/entities/`, `src/game/systems/`

## Goal

Give gameplay systems stable contracts so MapGenerator, PixiJS views, Vue UI, and tests do not reach into each other's private state.

## Work

- Define immutable generated-level data separately from mutable session state.
- Define entity IDs and lifecycle states for hero, castle, enemies, towers, projectiles, effects, and build pads.
- Add a small typed-by-convention event channel for state changes such as HP, currency, wave, build availability, teleport, victory, and defeat.
- Let systems return commands/events rather than mutating renderer or Vue state directly.
- Define snapshot selectors consumed by the renderer and HUD.
- Specify cleanup ownership for entities, textures, event listeners, pools, and scene containers.

## Acceptance criteria

- Headless simulation imports do not require DOM, Vue, or PixiJS.
- The renderer never decides damage, targeting, currency, or victory.
- Vue UI observes session snapshots/events and cannot mutate entity internals.
- Removing an entity produces one cleanup path and cannot award rewards twice.

## Verification

- Unit-test event subscription/unsubscription and a complete entity spawn-to-destroy lifecycle.


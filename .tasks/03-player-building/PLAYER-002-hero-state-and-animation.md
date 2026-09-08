# PLAYER-002 — Integrate hero states and animation

- **Priority:** P1
- **Depends on:** PLAYER-001, RENDER-001
- **Touches:** `src/states/heroes/`, `src/assets/game/sprites/hero-sprite-registry.js`, `src/core/AssetsManager.js`, `src/game/rendering/HeroView.js`

## Goal

Reuse or replace the existing disconnected hero state files so animation follows actual tower-defense movement and interaction state.

## Work

- Audit existing idle/run/jump/fall/hurt/death/turn/clear states and remove shooter/platformer assumptions that do not fit the new world.
- Add build/interact, celebrate, and respawn states where useful.
- Connect state transitions to simulation velocity, grounded status, building, damage/fall, victory, and defeat.
- Load mirrored/original animations once through the asset manager and define missing-animation fallbacks.
- Keep simulation facing independent from render-frame offsets and sprite mirroring.
- Ensure animation callbacks are cleared when actors change state or the session ends.

## Acceptance criteria

- Every hero simulation state has a valid visual fallback and no transition can strand a non-looping animation.
- Hero visuals face the correct projected movement direction in the fixed view.
- Build, jump/fall, respawn, victory, and defeat feedback are distinct.
- Asset loading and state setup are idempotent across level restarts.

## Verification

- Unit-test the state transition table and visually exercise every state using a debug harness.


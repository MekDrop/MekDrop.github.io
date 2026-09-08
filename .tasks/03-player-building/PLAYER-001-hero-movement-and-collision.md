# PLAYER-001 — Add hero movement, jumping, collision, and recovery

- **Priority:** P0
- **Depends on:** FOUNDATION-002, FOUNDATION-003, WORLD-001, RENDER-002
- **Touches:** `src/game/entities/Hero.js`, `src/game/systems/HeroMovementSystem.js`, `src/game/config/controls.js`

## Goal

Make the visible hero the player's third-person avatar for navigating the fixed-camera island and reaching build sites.

## Work

- Implement camera-relative or clearly documented world-relative run controls suitable for an isometric fixed view.
- Add acceleration/deceleration, facing, jump, gravity, grounded checks, and a forgiving ledge/coyote-time policy.
- Collide with solid terrain columns, castle, pipes, towers, and reserved structures while allowing movement across valid walkable grass/build cells.
- Prevent the hero from entering enemy-only path hazards if that is the chosen gameplay rule; document whether paths remain walkable.
- Detect falling into sky/void and respawn at the last safe checkpoint with a defined time/currency penalty rather than corrupting the session.
- Keep movement deterministic inside the fixed-step simulation.

## Acceptance criteria

- The hero can reach every generated build interaction cell promised by map validation.
- The hero cannot walk through the castle, pipes, towers, or off an unmarked solid boundary without triggering fall recovery.
- Movement speed and jump behavior are stable across render FPS.
- Respawning cannot overlap a tower, enemy, or active construction footprint.

## Verification

- Test movement vectors, diagonal normalization, jump timing, height transitions, collision, fall, and safe respawn.


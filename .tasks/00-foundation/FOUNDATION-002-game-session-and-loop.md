# FOUNDATION-002 — Add the game session and fixed-step loop

- **Priority:** P0
- **Depends on:** FOUNDATION-001
- **Touches:** `src/game/GameSession.js`, `src/game/GameLoop.js`, `src/components/GameCanvas.vue`

## Goal

Create one runtime owner for level state and a deterministic update loop independent of rendering frame rate.

## Work

- Add `GameSession` to own the generated level, hero, castle, towers, enemies, projectiles, currency, wave state, and result.
- Add a fixed-timestep simulation accumulator driven by PixiJS `app.ticker` using `ticker.deltaMS`; cap catch-up work after long tab stalls.
- Keep rendering interpolation separate from simulation mutation.
- Provide explicit `start`, `pause`, `resume`, `restart`, and `destroy` lifecycle methods.
- Make `GameCanvas.vue` a composition root that initializes dependencies rather than accumulating gameplay logic.
- Stop simulation on hidden/disposed views and prevent duplicate ticker registrations after remounts.

## Acceptance criteria

- Identical seed plus identical input timeline produces identical session outcomes at 30, 60, and 120 render FPS.
- Pausing stops waves, movement, attacks, cooldowns, and construction timers.
- Destroying the Vue component removes every ticker callback and browser listener.
- A session can restart without reloading the page or leaking old PixiJS nodes.

## Verification

- Add a fake-clock test covering start, pause, resume, catch-up cap, and destroy.


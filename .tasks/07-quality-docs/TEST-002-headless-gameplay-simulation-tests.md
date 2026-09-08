# TEST-002 — Add headless gameplay simulation tests

- **Priority:** P0
- **Depends on:** FOUNDATION-003, TOWER-003, ENEMY-002, WAVE-002
- **Touches:** `test/game/`, `src/game/`, test tooling in `package.json`

## Goal

Verify hero/build/economy/combat/wave/result logic without browser timing or PixiJS pixels.

## Work

- Build a deterministic test harness that loads a seed/fixture, submits timed input/commands, and advances fixed simulation steps.
- Cover purchases, construction, upgrades, selling, tower targeting, projectiles, statuses, rewards, enemy paths/pipes, castle attacks, pause, victory, defeat, and restart.
- Add result-order regressions for simultaneous lethal enemy/castle/projectile events.
- Run the same scenario under different render-frame chunking while keeping fixed simulation results equal.
- Add invariant assertions for nonnegative currency, unique IDs, one terminal state per entity, one reward per death, and no events after disposal.
- Produce concise end-state diffs when a replay diverges.

## Acceptance criteria

- Core game behavior is testable in Node without DOM, Vue, or PixiJS initialization.
- Same seed/config/command timeline produces the same normalized final snapshot.
- Major regressions identify the tick, command, and entity involved.
- Test fixtures remain small and explain the behavior they protect.

## Verification

- Run the complete headless suite plus repeated restart/disposal leak assertions.


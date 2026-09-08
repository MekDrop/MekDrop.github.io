# TOWER-004 — Add combat feedback and tune the first balance pass

- **Priority:** P2
- **Depends on:** TOWER-003, ENEMY-002, WAVE-001, RENDER-004
- **Touches:** `src/game/config/`, `src/game/rendering/`, `src/i18n/`, balance reports/fixtures

## Goal

Make combat understandable at the fixed camera scale and tune the campaign so strategy matters more than seed luck.

## Work

- Show range, target, cooldown/disabled state, upgrade state, and attack direction with restrained visual cues.
- Make projectile and impact feedback distinguish damage types and support effects.
- Add health/status indicators only when useful to prevent screen clutter.
- Build deterministic balance scenarios for early defense, split routes, pipe exits, fast swarms, armor, and final wave.
- Tune currency income, costs, DPS, control uptime, enemy effective HP, castle HP, and wave pacing.
- Establish acceptable win-rate and duration targets for the default difficulty and reject generator outliers that exceed them.

## Acceptance criteria

- A player can tell why a tower is not firing and which enemy/effect it is applying.
- Each tower and enemy archetype has a counter or trade-off.
- Sampled valid seeds remain beatable with more than one reasonable build plan.
- Balance changes live in config with recorded scenario results rather than unexplained code constants.

## Verification

- Run headless seeded balance simulations and manually play the worst/best scored map samples.

# ENEMY-002 — Add enemy model and roster

- **Priority:** P1
- **Depends on:** ENEMY-001, TOWER-002
- **Touches:** `src/game/entities/Enemy.js`, `src/game/config/enemies.js`, `src/game/systems/DamageSystem.js`

## Goal

Create a data-driven enemy roster that pressures different tower choices while sharing one reliable lifecycle.

## Work

- Define health, speed, radius, reward, castle damage, attack interval, armor/resistances, tags, and presentation keys.
- Implement at least four original roles: basic, fast, armored, and swarm/support-specialist.
- Define spawn, moving, pipe-enter, pipe-exit, castle-attacking, dying, escaped, and disposed states.
- Decide crowd/overlap behavior and stable offsets without using expensive general-purpose steering unless profiling justifies it.
- Scale stats through wave/difficulty config with explicit caps.
- Keep enemy simulation independent from sprite animation state and Yuka unless Yuka provides a concrete, measured benefit.

## Acceptance criteria

- New enemy types are added through validated config and presentation assets, not route-system changes.
- Every enemy has a meaningful tower interaction/counter and a clear reward-to-threat relationship.
- Status effects obey consistent immunity/resistance rules.
- Death, escape, and castle attack are mutually exclusive terminal paths.

## Verification

- Unit-test each archetype, scaling, resistance, status effect, terminal transition, and reward outcome.


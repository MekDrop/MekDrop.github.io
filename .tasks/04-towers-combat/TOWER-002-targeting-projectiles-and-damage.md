# TOWER-002 — Implement targeting, projectiles, and damage

- **Priority:** P0
- **Depends on:** FOUNDATION-002, TOWER-001, ENEMY-001
- **Touches:** `src/game/systems/TargetingSystem.js`, `src/game/systems/ProjectileSystem.js`, `src/game/systems/DamageSystem.js`, `src/game/entities/Projectile.js`

## Goal

Create deterministic combat from target acquisition through damage and enemy death.

## Work

- Query eligible enemies by range, route progress, height/ground-air tags, and selected target preference.
- Revalidate targets at fire time and use stable entity-ID tie-breakers.
- Support instant hits and pooled projectiles with speed, lifetime, collision radius, splash radius, and optional status effect payload.
- Define armor/resistance, minimum damage, damage-over-time, slow stacking/refresh policy, and kill attribution.
- Resolve rewards and death exactly once even when multiple projectiles land in the same step.
- Avoid firing through a pipe transition at an enemy that is temporarily non-targetable unless a tower explicitly supports it.

## Acceptance criteria

- Target choice and damage results are deterministic for the same session seed/input.
- Projectiles expire cleanly when their target dies, teleports, exits range according to policy, or the level ends.
- Splash damage cannot hit one enemy twice per impact.
- Enemy death removes threat before the next targeting pass and awards one reward.

## Verification

- Test tie-breaks, cooldown boundaries, target loss, projectile expiry, armor, splash, slow, simultaneous lethal hits, and pipe transitions.


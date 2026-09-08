# TOWER-001 — Define tower model and registry

- **Priority:** P0
- **Depends on:** FOUNDATION-001, FOUNDATION-003, WORLD-005
- **Touches:** `src/game/entities/Tower.js`, `src/game/config/towers.js`, `src/game/systems/TowerSystem.js`

## Goal

Create data-driven towers with consistent lifecycle, footprints, range, cooldown, and upgrade contracts.

## Work

- Define tower identity, type, owner pad, world position/elevation, build state, level, targeting mode, cooldown, and optional status effects.
- Define a registry schema for cost, footprint, range shape, fire rate, damage model, projectile, target filters, upgrade paths, and presentation keys.
- Keep static tower definitions immutable and runtime state instance-owned.
- Support target preferences such as first, last, strongest, weakest, and nearest without coupling to UI.
- Define tower destruction/disposal even if enemies cannot initially attack towers.
- Validate registry entries at startup with actionable errors.

## Acceptance criteria

- Adding a new basic tower requires config/art entries, not edits to a central switch statement.
- Range uses world/grid units independent of camera zoom and render scale.
- A tower owns no DOM or PixiJS display objects.
- Invalid footprints, costs, cooldowns, upgrade references, or presentation keys fail validation.

## Verification

- Unit-test registry validation, lifecycle, cooldown, target-mode change, and upgrade state migration.


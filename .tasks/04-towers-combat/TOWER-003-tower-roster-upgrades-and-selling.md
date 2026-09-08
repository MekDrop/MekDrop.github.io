# TOWER-003 — Add tower roster, upgrades, and selling

- **Priority:** P1
- **Depends on:** TOWER-001, TOWER-002, PLAYER-004
- **Touches:** `src/game/config/towers.js`, `src/game/systems/UpgradeSystem.js`, `src/game/systems/EconomySystem.js`, `src/assets/game/`

## Goal

Ship a compact tower roster that creates real choices across procedural routes.

## Work

- Implement at least three original cube-built roles: rapid single-target, slow/heavy area damage, and support/control.
- Give each role clear strengths, weaknesses, target rules, and visual identity.
- Add two or more upgrade decisions per tower without silently changing the footprint or invalidating neighboring pads.
- Implement sell confirmation and configured refund, including towers still under construction.
- Preserve current target preference across compatible upgrades.
- Ensure no one tower trivially covers every generated path or dominates all enemy armor/speed profiles.

## Acceptance criteria

- Each tower role is economically viable in at least one early/mid/late scenario.
- Upgrade UI can derive all labels, deltas, costs, and prerequisites from config/localization data.
- Selling removes targeting/projectiles safely and frees the pad.
- The roster uses original names and presentation rather than direct franchise characters/items.

## Verification

- Add deterministic scenario tests for each role and upgrade path plus sell/rebuild behavior.

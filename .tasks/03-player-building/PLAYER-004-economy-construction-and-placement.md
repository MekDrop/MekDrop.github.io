# PLAYER-004 — Implement economy, construction, and placement rules

- **Priority:** P0
- **Depends on:** PLAYER-003, TOWER-001
- **Touches:** `src/game/systems/EconomySystem.js`, `src/game/systems/ConstructionSystem.js`, `src/game/entities/BuildPad.js`

## Goal

Turn build confirmation into a fair, atomic gameplay transaction with visible construction state.

## Work

- Add starting currency, enemy rewards, tower costs, upgrades, and sell/refund policy from shared config.
- Make placement atomic: reserve pad, debit funds once, create construction, complete tower, and release reservation on cancellation/failure.
- Decide whether unfinished towers can target. Default to inactive until construction completes.
- Define construction duration and whether the hero must remain nearby. Default to one confirmed interaction without babysitting.
- Prevent placement on routes, pipes, water, void, slopes, decorations, castle cells, hero spawn, or another tower footprint.
- Publish currency/build-state events for UI and feedback.

## Acceptance criteria

- Funds can never go negative and duplicate input cannot buy the same tower twice.
- A failed/cancelled transaction restores the correct amount and frees the pad.
- Save/restart/dispose paths cannot leave ghost reservations.
- Rewards and refunds are granted exactly once.

## Verification

- Unit-test purchase success/failure, double-confirm, cancellation, construction completion, upgrade, sell, and session disposal.

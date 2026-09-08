# PLAYER-003 — Add hero-driven build interaction

- **Priority:** P0
- **Depends on:** PLAYER-001, WORLD-005
- **Touches:** `src/game/systems/BuildInteractionSystem.js`, `src/game/GameControls.js`, `src/game/rendering/SelectionRenderer.js`, `src/components/GameCanvas.vue`

## Goal

Require the player to physically control the hero near a build pad before placing or managing a tower.

## Work

- Detect the nearest valid pad within a configurable world-space interaction radius and line/height rules.
- Highlight exactly one candidate deterministically; use facing/distance tie-breakers.
- Open a build radial/list on interact, allow tower selection, confirm, and cancel without moving the camera.
- Let interaction manage an existing tower for inspect/upgrade/sell actions.
- Suspend conflicting movement/build inputs while a selection UI is open without pausing enemies unless explicitly configured.
- Revalidate pad availability and currency at confirmation time to avoid stale UI races.

## Acceptance criteria

- Clicking a distant map cell cannot place a tower.
- A build action fails safely if the hero leaves range, the pad becomes occupied, or currency changes before confirmation.
- Selection feedback identifies pad, footprint, cost, range preview, and invalid reason.
- Keyboard and supported pointer/touch controls can complete the same build flow.

## Verification

- Test candidate selection, ties, out-of-range cancellation, stale confirmation, occupied pads, and existing-tower interaction.

# UI-001 — Add the gameplay HUD

- **Priority:** P0
- **Depends on:** FOUNDATION-003, PLAYER-003, WAVE-001, CASTLE-001
- **Touches:** `src/components/game/`, `src/components/GameCanvas.vue`, `src/i18n/`, `src/layouts/MainLayout.vue`

## Goal

Expose the information needed to play without obscuring the fixed-camera island or existing personal-site navigation.

## Work

- Show castle current/max HP, currency, wave number/total, enemies remaining, countdown, pause state, and current seed.
- Show contextual build/manage prompts only when the hero has a valid nearby pad/tower.
- Add tower chooser/manage panel with cost, affordability, range, damage/role, upgrade, target mode, and sell data.
- Reserve responsive HUD-safe screen regions when camera framing is calculated.
- Use Vue for accessible interface chrome and PixiJS only for world-anchored markers/effects.
- Localize all player-facing text in `en-US.yml` and `lt.yml` with resilient fallbacks.

## Acceptance criteria

- HUD data comes from session selectors/events and does not poll or mutate entity internals.
- Critical state remains readable over every map palette and common viewport size.
- The castle HP change, next-wave timing, insufficient funds, invalid placement, and final-wave state are unmistakable.
- Existing toolbar search and language controls continue working.

## Verification

- Add component tests for major HUD states and visual checks at desktop/tablet/mobile sizes.


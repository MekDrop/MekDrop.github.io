# UI-002 — Add start, pause, onboarding, and result flow

- **Priority:** P1
- **Depends on:** UI-001, WAVE-002
- **Touches:** `src/components/game/`, `src/i18n/`, `src/game/GameControls.js`

## Goal

Make the game understandable from first load through victory, defeat, and replay.

## Work

- Add loading/error, ready/start, pause/settings, victory, and defeat overlays.
- Teach movement, jump, approach-a-pad, build, tower management, waves, pipes, and castle HP through short contextual prompts.
- Add visible controls/help that adapts to active input type.
- Allow pause/resume/restart with confirmation where currency/progress would be discarded.
- Present same-seed replay, new-seed play, and seed-copy actions on results/error screens.
- Make generator failure actionable with seed and validation summary, not a blank canvas.

## Acceptance criteria

- A first-time player can start a wave and build a tower without external instructions.
- Pause gates simulation and relevant inputs while keeping menus operable.
- Result overlays accurately reflect the locked session result and cannot trigger duplicate restart actions.
- Onboarding can be skipped/reset and does not reappear on every locale route unexpectedly.

## Verification

- Test all phase transitions, keyboard focus containment, confirmation flows, onboarding persistence, and generator errors.


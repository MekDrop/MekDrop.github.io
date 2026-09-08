# FOUNDATION-004 — Reconcile current controls with fixed-camera play

- **Priority:** P0
- **Depends on:** FOUNDATION-001
- **Touches:** `src/game/GameControls.js`, `src/game/actions/`, `src/game/config/controls.js`, `src/components/GameCanvas.vue`, `quasar.config.js`

## Goal

Preserve the useful uncommitted control refactor while ensuring release gameplay has a fixed camera and hero-focused controls.

## Work

- Keep screenshot, regeneration, and debug-arrow actions where useful.
- Move pan, zoom, and view rotation behind an explicit development/debug flag; disable them during ordinary play.
- Reassign directional keys to hero movement and add jump, build/interact, tower choice, pause, and cancel bindings.
- Separate edge-triggered actions from held movement state; avoid relying only on repeated `keydown` events.
- Preserve editable-field protection, pointer cleanup, and screenshot notification behavior.
- Ensure regeneration becomes a safe session restart, not a renderer-only map swap while old entities survive.

## Acceptance criteria

- Normal players cannot pan, rotate, or zoom the camera.
- Developer camera inspection can be enabled without changing gameplay world coordinates.
- Input state clears on blur, visibility loss, pause, pointer cancellation, and component teardown.
- No keyboard shortcut interferes with the toolbar search field or standard browser save behavior unless the canvas has deliberate focus.

## Verification

- Add input tests for held movement, single-fire actions, focus handling, debug gating, and disconnect cleanup.

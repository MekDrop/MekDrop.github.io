# UI-003 — Complete responsive input and accessibility

- **Priority:** P1
- **Depends on:** FOUNDATION-004, PLAYER-003, UI-001, UI-002
- **Touches:** `src/game/GameControls.js`, `src/components/game/`, `src/css/`, `src/i18n/`

## Goal

Make the fixed-camera game usable across supported viewport/input modes and ensure essential information is not canvas-only.

## Work

- Finalize keyboard bindings and decide supported gamepad and touch control scope; add remapping only if it can be persisted/tested reliably.
- Add touch movement/jump/interact controls or explicitly present desktop-only requirements on unsupported devices.
- Ensure build/tower menus have keyboard navigation, visible focus, semantic labels, and sensible focus restoration.
- Mirror critical canvas state in accessible DOM text/live regions without announcing every damage tick.
- Support reduced motion, high contrast/readability, text scaling, and non-color status distinctions.
- Prevent browser scrolling/zoom interception only while relevant controls are focused/active.

## Acceptance criteria

- The full level loop can be completed with keyboard alone.
- Supported touch/gamepad modes can move, jump, build, manage towers, pause, and restart.
- Screen-reader users receive castle HP warnings, wave transitions, build errors, and results at useful frequency.
- Small screens do not overlap controls, HUD, toolbar, or critical island areas.

## Verification

- Run keyboard-only, automated accessibility, reduced-motion, 200% text, and representative touch viewport checks.

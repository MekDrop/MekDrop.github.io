# Runtime Error Recovery Rules

Read this when changing unexpected application error handling, error notifications, reload behavior, or related locale labels.

Handle unexpected application errors through `src/boot/runtime-errors.js`.

The error notification must remain visible and provide two localized actions:

- **Refresh**, showing a 30-second countdown and reloading immediately when selected.
- **Dismiss**, closing the notification without reloading.

The page must reload automatically when the countdown expires. Dismissing the notification must cancel both the countdown interval and the pending automatic reload timer.

Keep the action labels synchronized across every locale in `src/i18n/` and cover manual refresh, automatic refresh, and timer cancellation in `test/unit/runtime-errors.test.js`.

# TEST-003 — Cover a deterministic gameplay journey in Cypress

- **Priority:** P1
- **Depends on:** UI-002, TEST-002
- **Touches:** `test/cypress/e2e/`, `src/components/GameCanvas.vue`, test-only session hooks

## Goal

Protect the browser integration from page load through building, waves, castle damage, result, and restart.

## Work

- Add a documented test-only seed/config injection path without exposing cheat controls in production.
- Test canvas/session readiness and preserve the existing personal-site toolbar/locale checks.
- Drive the hero to a pad, open build UI, place/upgrade/sell a tower, start a wave, and observe deterministic HUD changes.
- Cover a pipe traversal indicator, castle damage, victory, defeat, replay same seed, and new-seed restart using short fixture waves.
- Assert fixed-camera state does not change under normal movement/build controls.
- Capture screenshots only for stable high-value states and avoid brittle pixel-perfect animation timing.

## Acceptance criteria

- The E2E suite catches disconnected controls, stale HUD state, failed mount, broken restart, and result-flow regressions.
- Tests wait on explicit application state/DOM semantics rather than arbitrary sleeps.
- Locale routes still load and gameplay controls remain focus-safe around the toolbar.
- CI command runs headlessly through the existing Quasar start-test workflow.

## Verification

- Run `npm run test:e2e:ci -- --spec test/cypress/e2e/IndexPage.cy.js,<game-spec>`.


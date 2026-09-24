# Dodge Movement Rules

Read this when changing hero dodge behavior, directional double-tap behavior, or dodge-facing behavior.

Hero dodge behavior should follow Unreal Tournament '99 movement rules as closely as the isometric controller allows:

- Tap versus double-tap is resolved by the configured input time window.
- Directional double-tap input produces an immediate dodge impulse in that input direction.
- Backward and side dodges preserve the hero's facing direction, so the move reads as a dodge instead of a jump or turn unless the user explicitly asks for different behavior.

Likely entry points:

- `src/game/GameControls.js`
- `src/game/actions/`
- `src/game/config/controls.js`
- `test/cypress/e2e/HeroMovement.cy.js`

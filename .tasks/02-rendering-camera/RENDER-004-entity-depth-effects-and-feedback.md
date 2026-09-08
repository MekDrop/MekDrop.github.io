# RENDER-004 — Render entity depth, animation, and effects correctly

- **Priority:** P1
- **Depends on:** RENDER-001, RENDER-002, PLAYER-002, TOWER-002, ENEMY-003
- **Touches:** `src/game/rendering/EntityRenderer.js`, `src/game/rendering/EffectsRenderer.js`, `src/game/rendering/SelectionRenderer.js`

## Goal

Make moving actors and combat effects feel grounded in the cube world and occlude correctly in the fixed view.

## Work

- Sort dynamic actors by projected depth/elevation without reordering static terrain unnecessarily.
- Anchor hero, enemies, towers, projectiles, health bars, and shadows to shared world positions.
- Render pipe enter/exit transitions without a visible actor crossing the skipped route interval.
- Add pooled hit flashes, muzzle flashes, impact particles, damage/heal numbers, currency pickups, construction dust, and castle-hit feedback.
- Add route/build/range debug overlays that consume model data but never mutate it.
- Render path arrows from the castle-rooted quickest-path direction field on every route segment; all arrowheads must consistently lead from gates toward the castle.
- Respect reduced-motion settings by simplifying flashes, particles, shakes, and transition motion.

## Acceptance criteria

- Actors pass behind/in front of terrain and structures consistently at every supported elevation.
- Effects clean themselves up and do not create unbounded display objects or ticker callbacks.
- Teleport, tower target, damage, enemy death, castle hit, victory, and defeat are visually unambiguous.
- Screen shake, if used at all, affects a temporary presentation layer and does not violate the fixed gameplay camera contract.

## Verification

- Create deterministic visual fixtures for overlap, elevation, pipe transitions, and simultaneous combat effects.

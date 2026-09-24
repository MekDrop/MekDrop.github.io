# Map Generation Rules

Read this when a request involves map generation logic, path generation, terrain shaping, water placement, tile rendering, gates, waterfalls, or validation for the isometric game layer.

`docs/map-generator-rules.md` is the canonical specification. Read it before editing implementation code.

Do not implement shortcuts that violate:

- two-tile path width
- grid-aligned ownership
- projection consistency
- slope-length validation
- gate placement
- waterfall upstream-length rules
- final validation requirements

Likely entry points:

- `src/game/MapGenerator.js`
- `src/game/PlayCanvasRenderer.js`
- map-related objects under `src/game/objects/`
- relevant Cypress specs under `test/cypress/e2e/`

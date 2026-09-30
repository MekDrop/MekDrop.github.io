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

- `src/game/generator/map/MapGenerator.js`
- `src/game/PlayCanvasRenderer.js`
- map-related objects under `src/game/objects/`
- relevant Cypress specs under `test/cypress/e2e/`

## Runtime walking paths

`src/game/navigation/WalkingPaths.js` derives walking centerlines from `grid`,
`heightmap`, and `tileMeta`. Gate entries and castle doors identify route endpoints.
Stored maps must not author `paths`; map loading and generator finalization rebuild
routes and arrows from the tile surfaces.

After gameplay edits the tile topology, call `WalkingPaths.rebuild(mapData)`.
It replaces `mapData.paths` and `mapData.arrowData` and returns the new graph and
castle distances. Consumers must read the current fields after rebuilding rather
than retain old route arrays. Disconnected gates have empty routes. Removing a
single lane disables the affected two-lane segment; restoring its tiles restores
connectivity. Tile slope metadata controls edge heights, and overpass tile metadata
keeps deck and ground graph nodes separate.

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

## Authored map objects

Saved JSON maps and generator finalization author entities through `objects[]`:

- `Gateway`: `entry` contains its grid column, row pair, side, and color; an optional
  `symbol` selects its banner.
- `Rivers`: one grouped `rivers` array retains connected water/lava channels,
  cascades, sources, and waterfalls.
- `GroundCover`: one batched `placements` array retains variant, grid position,
  local offsets, rotation, and scale. Do not turn dense cover into independent GPU entities.
- `Overpass`: `layout` retains its deck and approach topology. The owning class
  builds stairs and registers collision; terrain publishes the shared tile surfaces.
- `SpawnPoint`: `position` supplies the playable hero's spawn. A `Hero` record is
  still a debug animation actor, not the playable hero.
- `IslandConnector`: `topology` describes connector cells and island membership;
  motion remains shared across all island attachments.
- `Castle`: `navigation` stores its grid foundation and route endpoints alongside
  its existing generation inputs.

`MapObjectDefinitions.prepare(map)` publishes
non-enumerable runtime views (`entries`, `riverData`, `groundCoverData`,
`overpassData`, `heroSpawn`, `islandConnectorData`, and `castle`) from the records.
These views keep shared terrain, navigation, and physics consumers working and are
excluded from JSON and structured clones. Prepare cloned maps before reading them.
Loading, walking-path rebuilding, terrain population, and factory preparation do
this automatically. Do not author both forms in a saved map.

`MapObjectFactory` owns construction and asset discovery for these objects.
Frame-driven objects may implement `onFrame(deltaTime, hero, camera)`. Objects
that update themselves through application events should not implement that hook.
The scene registry owns disposal and forwards shared island offsets.

Keep `grid`, `heightmap`, `tileMeta`, dimensions, map identity, and test/HUD
configuration at map level. Routes and arrows are derived runtime data.

## Bookshelf placement

These rules apply to every room generator, authored room layout, and placement
repair that places a bookcase, including mirrored and rotated layouts.

- Place bookshelves first, before desks, chairs, benches, chests, and other loose
  furniture. Reserve their access space before placing the remaining furniture.
- Place the back of the cabinet against a solid wall, with at most 5 cm of
  clearance. Measure from the cabinet's actual back surface to the wall's inner
  face, not from either object's origin. Do not block doors or windows.
- Face the open shelves and book spines into the room. Verify the final model
  orientation after all map transforms, rotation corrections, and mirroring.
- Keep at least 1 m of unobstructed standing space in front, across the full
  cabinet width, connected to the room's walking routes. A gap behind the
  cabinet or a space blocked by a chair or table does not count as access.
- Placement repair must preserve wall proximity, facing, and access together.
  Reposition conflicting loose furniture rather than moving a bookcase into
  the middle of the room or filling its reading space. If no valid arrangement
  exists, report the placement conflict instead of silently accepting it.
- Verify wall clearance, inward facing, and reachable reading space in focused
  placement checks and inspect the book-facing side in the actual game.

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

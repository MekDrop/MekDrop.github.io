# Map Generator Rules

These rules are the canonical specification for any change to map generation logic, path generation, terrain shaping, water placement, or tile rendering. When updating map generation, treat this document as binding requirements rather than suggestions.

The words **must**, **must not**, **always**, **never**, and **exactly** are acceptance criteria. A generated map that violates one of them is invalid and must be rejected or regenerated before rendering or gameplay begins.

## 1. Grid and projection

* The map uses one fixed square grid.
* Every tile uses the same horizontal size and coordinate system.
* Every tile must be drawn as a block in the same isometric 45-degree projection.
* Grass, path, water, and structure tiles must share the same angle, orientation, scale, and perspective.
* No tile may use a different rotation, free perspective, front view, or top-down view.
* Tile edges must align exactly with neighbouring tile edges.
* A tile may be flat or sloped, but its footprint must remain aligned to the grid.

## 2. Tile ownership

* Every grid cell has exactly one primary type:
  * grass
  * path
  * water
  * structure
* One cell cannot contain both grass and path.
* Two routes may cross in plan view only at a validated grade-separated crossing. An unplanned flat four-way path crossing is forbidden.
* Every path tile occupies the entire cell.
* Half-path/half-grass tiles are forbidden.
* Diagonal yellow wedges, narrow road strips, and floating path overlays are forbidden.
* Decorative bevels may soften edges but cannot change the tile footprint.

## 3. Block shape

* Every visible terrain tile must be rendered as one complete grid-aligned block.
* Flat tiles use complete square top faces.
* Sloped tiles use one continuous planar top face.
* Sloped tiles may use partial block volume, but still occupy one complete grid cell.
* No tile may visually merge across several cells as one irregular shape.
* No path surface may float above a grass block.

## 4. Path width and spacing

* Every path is exactly two complete tiles wide.
* It may never become one tile or three, four, or more tiles wide.
* Both path lanes must remain adjacent.
* Both lanes must use the same direction, elevation, and slope profile.
* The full two-tile width must be preserved through:
  * straight sections
  * turns
  * slopes
  * bridges
  * merges
  * intersections
  * castle approaches
  * gate sections
  * pipe interfaces
* Turns, merges, intersections, castle approaches, and pipe interfaces must not create widened road plazas.
* Every yellow tile must belong to the validated path graph.
* If two path sections run in parallel, they must be separated by at least two full grass tiles.
* The minimum parallel spacing is:

```text
path | grass | grass | path
```

* One grass tile of separation is not enough.
* Zero-tile separation is forbidden unless the paths are inside a predefined merge zone.
* The rule applies to flat paths, sloped paths, and bridges.
* Decorative objects do not count toward the spacing distance.

## 5. Path direction

* Path tiles connect only through full north, east, south, or west edges.
* Diagonal contact does not create a connection.
* A path may turn only between complete tiles.
* A path cannot curve through part of a grass tile.
* Both lanes must follow the same axis.
* A path slope must face in the direction of travel.
* A slope may not face sideways across the path width.
* Path top faces must use the exact same isometric projection, diamond footprint, scale, and angle as grass top faces.
* A path is a terrain-material replacement, never an overlay rectangle or differently projected mesh.

## 6. Path turns

* Turns must use predefined two-tile-wide templates.
* Every turn uses only complete path tiles.
* Both lanes must remain continuous through the corner.
* Road boundaries must not use diagonal cuts, rounded corners, chamfers, or bevels that make a turn appear non-orthogonal.
* Decorative shading must not obscure the full-cell 90-degree turn geometry.
* Arbitrary rounded or diagonal turns are forbidden.

## 7. Path merges

* Entry paths may merge only when their:
  * elevation
  * direction
  * lane alignment
  * slope profile
  are compatible.
* Paths cannot merge merely by touching sides.
* After paths merge, they cannot split again.
* The merged path remains exactly two tiles wide.
* All entry paths must eventually become one final path to the castle.
* The parallel-spacing rule may be broken only inside a predefined merge zone.

## 8. Gates

* A gate must be placed on the first playable path tiles at the island boundary.
* No normal path tiles may appear before or outside the gate.
* The gate must align with the two-tile-wide path.
* The gate opening must cover both lanes.
* Terrain may exist beside the gate, but not in front of it.
* Every gate must connect to a valid path leading to the castle.
* Gates may exist only at valid island-boundary entry points.
* Decorative or gate-like structures must never appear in the middle of a path.

## 8a. Path graph, routing, and arrows

* A generated level must contain between one and four gate-to-castle routes.
* Every ordinary path cell must be reachable from at least one boundary gate and must be able to reach the castle.
* Decorative roads, disconnected roads, orphan branches, dead-end branches, and unrelated loops are forbidden.
* Every enemy must select the quickest valid route to the castle using only generated path and pipe-transition graph edges.
* Equal-cost routes must use deterministic tie-breaking so the same seed produces the same movement.
* Direction arrows must be derived from the same quickest-route data used by enemies.
* Every arrow must point from a gate toward a neighbour with strictly lower remaining travel cost to the castle.
* Random, backward, decorative, or castle-to-gate arrows are forbidden.
* Debug arrows on ramps must be centered within a slope tile and rotated flush with that tile's walkable plane. They must not float above, clip through, or remain horizontal on a sloped path.

## 8b. Pipe teleports

* Pipes must be paired teleport endpoints with stable pair identifiers; unpaired endpoints and teleport loops are invalid.
* A pipe must occupy reserved flat grass beside a path and must never occupy, replace, cover, or overlap a main path tile.
* The pipe mouth must directly face and connect to the path direction at enemy ground level.
* The mouth must abut a two-tile-wide path interface. If connector path cells are required, the connector must remain exactly two full tiles wide and orthogonal without widening the main path.
* Enemies may enter a pipe only through its connected path-facing mouth and emerge from the paired endpoint onto its connected path interface.
* A pipe transition is used only when it belongs to the enemy's quickest valid route to the castle.
* A visible pipe must be a complete, smooth, round cylindrical pipe with a full circular opening and a wide flared rim.
* Half-pipes, cutaway tunnels, arches pretending to be pipes, and cubist pipe bodies are forbidden.

## 9. Path elevation

* Flat path sections stay at one elevation.
* Elevation changes use continuous planar ramps, not stairs.
* Ordinary slopes change elevation by one block per tile. A grade-separated path crossing uses two consecutive half-block ramp tiles per block of elevation so the approach remains gentle.
* Both lanes must rise or descend together.
* A slope cannot turn, twist, or change direction midway.
* A slope cannot incline sideways across the path.
* Required slope length is:

```text
slope tiles = absolute elevation difference
```

* A rise of two blocks requires two consecutive slope tiles in each lane.
* For a grade-separated crossing, required ramp length is:

```text
ramp tiles = 2 * absolute elevation difference
```

* Every grade-separated ramp cell keeps a full square grid footprint and its exposed sides are filled with earth; the ramp is never a floating sheet.
* Every elevated flat approach cell is a solid earth-filled column up to its path surface. It must never be reclassified as an ordinary thin bridge or expose a lower ledge beneath its deck.
* Every exposed side and fascia belonging to a grade-separated ramp, flat approach, or crossing deck uses a dedicated dirt-only crop of the normal terrain-wall texture. Green grass pixels, dangling grass roots, grass fringes, and path-surface textures are forbidden on those fill faces. Path-surface material is restricted to the walkable top; railings may retain their structural path material.
* A grade-separated approach must not raise or add lateral support cubes beside the path. Adjacent terrain keeps its generated elevation; only the two path lanes form the filled ramp and approach.
* A grade-separated deck must leave enough clearance beneath its fascia for the complete collision height of a walking actor.
* The deck top and underside are separate collision surfaces: actors may walk on top or pass underneath, but jumping actors must collide with the underside.
* Both outer edges of a grade-separated path must have continuous railings across its complete ramp, elevated approach, and crossing deck. Rail segments on slopes must follow the walkable plane rather than stepping or floating horizontally.
* After a slope, the path must remain flat for at least one tile before turning.
* Terraces are allowed as:

```text
slope -> flat tile(s) -> slope
```

### 9a. Path lateral support and bridges

* At each longitudinal path position, the two-lane path must inspect the terrain immediately outside both lateral edges.
* A lateral side supports a solid path only when an in-bounds, non-water terrain column reaches at least the path deck elevation.
* A straight path position becomes a bridge only when both lateral sides are missing, water, or lower than the path deck.
* If exactly one lateral side has a supporting block, the path remains solid. The generator must materialize or raise an in-bounds grass support block on the unsupported side when doing so does not overwrite a river.
* Both lanes must switch to bridge rendering together; a half-solid, half-bridge path position is forbidden.
* A bridge must be a straight span. Bridge decks must never turn 90 degrees, merge, branch, or form an intersection.
* Every turn, merge, and intersection must be a normal solid path landing. The generator must add or raise adjacent grass support blocks where needed; bridge spans must end before entering the landing and may resume only as a separate straight span after it.
* Higher adjacent terrain may border a solid path because its column still reaches the path elevation.
* Every bridge not crossing water or lava must preserve a complete grass-topped terrain block one level below each deck tile, except for grade-separated approach fill, which is dirt-only as defined above. Bare earth must not be exposed beneath ordinary spans.
* Grass beneath a bridge is reserved, non-buildable terrain. Trees, bushes, flowers, mushrooms, loot crates, and other generated objects must never spawn on it.
* Water and lava bridges keep their validated flowing surface beneath the deck instead of adding grass.
* Each straight bridge span must use continuous outer fascia and continuous rail runs. Per-tile border seams, coincident internal faces, and overlapping border geometry are forbidden.
* Bridge borders must remain visually stable without crawling, flickering, or noisy seams at fractional supported zoom levels, including `1.08`.
* Gate structure tiles are exempt from automatic bridge conversion.

## 10. Grass terrain

* Grass may be flat, sloped, terraced, or cliff-shaped.
* Grass elevation may vary more freely than path elevation.
* Terrain transitions must form readable hills, valleys, plateaus, terraces, or cliff bands.
* A single void tile may never be completely enclosed by terrain on all four cardinal sides. The island mask fills such holes before terrain materialization, and final validation rejects any introduced later.
* Random isolated height changes should be avoided.
* A grass slope should normally begin along a contour at least two tiles wide.
* One-tile slopes are allowed only for narrow decorative terrain.
* Grass slope length follows:

```text
slope tiles = absolute elevation difference
```

* Buildable grass must remain flat.
* Slopes cannot begin beneath:
  * trees
  * towers
  * gates
  * castle foundations
  * path tiles
  * reserved buildable areas

## 11. Buildable areas

* Buildable tiles must be green, flat, and unobstructed.
* Buildable areas must be large enough for tower footprints.
* Sloped, twisted, water-covered, or cliff-edge tiles are not buildable.
* Trees and decorations must not occupy reserved buildable cells.
* Buildable areas should remain clearly visible.

## 11a. Loot crates

* Loot crates must be generated deterministically from the level seed.
* They may spawn only on reachable, flat grass cells reserved for loot.
* They must not overlap paths, gates, castle footprints, pipe footprints or interfaces, water, cliffs, trees, towers, or other reserved cells.
* Every crate must be reachable and openable by the player character.
* Opening a crate grants deterministic level resources; the reward is not audio-dependent.

## 12. Water sources

* Every waterfall requires a valid inland water source.
* Valid sources include:
  * stream
  * pond
  * reservoir
  * spring
  * castle drainage channel
* Water must flow continuously from higher terrain to lower terrain.
* Water cannot flow uphill.
* Water cannot begin directly at a cliff edge.
* Every water tile must have a defined flow direction.

## 13. Waterfall setback

* A water source must begin at least five tiles inland from the nearest outer island edge.
* Water must travel through at least five connected water tiles before reaching the waterfall.
* A one-tile pool beside a cliff is invalid.
* Required sequence is `source -> at least 5 flow tiles -> cliff-edge tile -> waterfall`.
* The generator must reject any waterfall with fewer than five upstream water tiles.

## 14. Waterfall placement

* A waterfall begins only where flowing water reaches a valid cliff edge.
* Its direction must match the final water-flow direction.
* There must be empty space in front of and below it.
* A waterfall cannot pass through:
  * terrain
  * paths
  * bridges
  * gates
  * trees
  * towers
  * castle structures
* Waterfalls cannot be placed directly beside gates.
* Waterfall width must match the upstream water width.

## 15. Water and paths

* Water cannot occupy path tiles.
* Paths may cross water only by:
  * bridge
  * causeway
  * culvert
* Crossings must remain exactly two tiles wide.
* Both lanes must share the same direction and elevation.
* Water must remain visibly continuous beneath or beside the crossing.
* If a path segment is surrounded by water as a pure crossing, it must render as a bridge deck rather than a solid terrain block.
* A bridge crossing may show water below it, but must not render earth, grass, or filled support mass beneath the path deck unless an explicit support structure tile exists.

## 16. Trees

* Trees may be placed only on grass.
* Trees cannot occupy:
  * path tiles
  * water tiles
  * waterfall tiles
  * gate tiles
  * bridge tiles
  * castle tiles
  * tower footprints
  * reserved buildable tiles
* Tree trunks require a flat or explicitly tree-compatible tile.
* Trees should normally remain at least one tile away from paths.
* Large trees require more clearance than small trees.
* Trees must not hide:
  * gates
  * merges
  * slopes
  * castle entrances
  * tower visibility
* Trees should appear in controlled clusters, not on every unused grass tile.

## 17. Castle

* The castle must stand on a valid flat foundation.
* Its entrance must align with the final two-tile-wide path.
* The final path must end directly at the castle entrance.
* Trees, water, and decorations must not block the entrance.
* The castle must be placed away from entry gates.
* Enough green ground must remain around the castle footprint.

## 18. Floating-island structure

* The island is built from connected blocks.
* All playable terrain must belong to the same connected island.
* No playable block may float separately.
* The underside may be irregular, tapered, or decorative.
* Surface geometry and underside decoration should be generated separately.
* Paths may reach the island edge only at designated gates.
* Every terrain voxel must use one canonical cube width, depth, and height. Materials may vary, but terrain cube dimensions may not.

## 19. Generation order

1. Generate island footprint.
2. Assign terrain heights.
3. Generate the path graph.
4. Expand every path into two lanes.
5. Apply turns and slopes.
6. Place boundary gates and castle.
7. Create the quickest-route cost field and direction arrows.
8. Place paired path-facing pipes on reserved adjacent grass and add their graph transitions.
9. Recompute and validate quickest routes with pipe transitions.
10. Generate water sources and flow.
11. Place waterfalls.
12. Reserve buildable grass and reachable loot-crate candidates.
13. Place trees and decorations on remaining valid cells.
14. Validate topology, footprints, bounds, spacing, routing, and route continuity.
15. Render only after validation passes.

## 19a. Regeneration variety

* Regenerating the map must be capable of producing meaningfully different valid layouts.
* The island footprint must not remain effectively identical on every generation.
* Castle placement must vary between valid regions of the island instead of staying at one fixed coordinate.
* Entry path selection, merge layout, terrain massing, and major landform composition should also vary when possible.
* Variation must preserve all structural rules in this document; randomness is allowed only inside valid constraints.
* A generator that always produces the same earth shape and castle position is invalid, even if the rest of the map passes validation.
## 19b. Current implementation notes

These notes describe the generator behavior currently implemented in `src/game/MapGenerator.js`. They are not a replacement for the canonical rules above, but they document the present constraints and shortcuts in the live generator.

* The current generator uses four predefined entry row bands:
  * rows `[5, 6]`
  * rows `[10, 11]`
  * rows `[19, 20]`
  * rows `[25, 26]`
* Each generated map selects between one and four of those bands.
* The current generator places gates only on the left or right island boundary.
* Top-edge and bottom-edge gates are not implemented yet.
* Left-side gates currently use column `4`.
* Right-side gates currently use column `37` on the 42-column map.
* For multi-path maps, the generator currently enforces mixed side usage when possible, so not every entry path starts from the same side.
* Castle placement still determines which entry rows are allowed to use the right side safely.
* The castle entrance currently remains on the left face of the castle footprint.
* Entry paths currently use a route family with a shared final trunk to the castle.
* Multi-route maps place that shared trunk on an outer route band so its merge corridor cannot continue through the trunk as an unplanned four-way crossing.
* Multi-path maps may contain one grade-separated crossing before their final merge. The crossing is uncommon with two paths and progressively more likely with three or four paths. The upper branch rises two blocks over four half-block ramp cells per side, crosses on a two-tile-wide deck with sufficient actor clearance, descends the same way, and remains disconnected from the lower route at the crossing.
* When spacing allows, a non-bridge entry branch may use one extra orthogonal bend before it joins the shared trunk.
* Those bends remain fully grid-aligned and two tiles wide.
* Bridge crossings should stay as simple straight spans rather than curved bridge turns.
* True multi-turn path templates beyond a single extra bend are not implemented yet.
* The current merge model still uses one shared merge column for all selected entry paths.
* The current generator does not yet support branch-specific merge zones or re-splitting after merge.
* River generation uses a weighted zero-to-six count:
  * 15% of maps request no rivers.
  * Each successively larger non-zero count is less likely than the previous count.
* When an island has one or two generated rivers, it has a 10% chance for one or two of those rivers to be lava. Islands with more than two rivers never contain lava. Lava follows the same validated source, flow, bridge, and waterfall topology as water, sits nearer the bank top, and renders as an opaque, slow-moving, cel-shaded yellow-orange molten surface. Its first tile has the same one-third-height grass-and-earth source cap as water. Digging that cap reveals embedded source stones. Only the source-cap tile has structural digging behavior; all surrounding flat grass, including edge-sharing and diagonal source neighbors as well as downstream and waterfall banks, remains normally diggable after any occupying vegetation or ground cover is removed. Contact with exposed lava beyond the cap ignites the hero, who submerges while burning and disappears without leaving a surface ash disc; jumping completely over it remains safe.
* Rivers begin on terrain at least two blocks high and at least five tiles inland.
* Each river preserves non-increasing water elevation, keeps the playable island connected, and ends in an outward-facing edge waterfall.
* Separate rivers, including their waterfall mouths, keep at least one complete earth cell between them; diagonal corner contact is not allowed. River routes and terminal falls also keep a six-cell setback from the complete castle footprint so waterfalls are distributed around the island rather than clustering beside the castle.
* River channels occupy a full grid cell with a half-cube-deep, water-filled channel and no inset margin between water cells.
* A perpendicular river crossing converts exactly two path-lane cells into one thin, unified bridge deck with railings while water remains continuous below. The combined deck omits buried approach-facing end polygons and the redundant coplanar top underlay, eliminating depth flicker at every zoom while keeping its visible top level with the path.
* River surfaces and waterfalls use an animated cel-shaded water material with screen-space refraction, half-cube depth attenuation, and a brighter reflective surface. Every horizontal cell shows clearly readable downstream motion through broad, quantized dark-blue, blue, and cyan color patches plus matching directional surface deformation; ordinary stretches do not require white foam to communicate flow. Each cell uses its own route direction so the visible flow turns at bends rather than scrolling through them unchanged. Direction-dependent surface displacement fades to a shared boundary value on every cell edge, keeping adjoining direction groups watertight at 90-degree bends while their interiors animate along their own flow directions. Each horizontal river is built as one continuous half-height volume with a sealed deep-water bottom; its exposed map-edge sides darken with depth and deform with the top surface. A water side must never overlap a terrain wall, and internal cell walls and waterfall-facing walls are never rendered. A waterfall lip tapers that full depth into a finite-thickness falling volume with connected front, back, and lateral faces, and transparent rear faces must not blend through the nearest water surface.
* River water remains level across the complete half-height cell and reaches the cell boundary before waterfalls bend over a welded rounded spillway lip into one continuous convex, rippled volume rather than disconnected layered shells; the horizontal surface and lip use matching edge subdivisions, optical material settings, and join shading so no raster crack or stitched color band can expose the riverbed. Ordinary horizontal water has no pale looping foam lines; its sealed lower surface instead uses quiet, static natural riverbed tones. Every non-bridge horizontal segment materializes full-height earth banks on both lateral sides, including where the original island mask contained a notch. A terminal waterfall also materializes in-bounds, full-height earth shoulder cells immediately beyond both sides of its lip, leaving only the center outflow open. Every source is enclosed by a complete 3×3 ring of raised earth, excluding only cells occupied by its downstream river route, so neither orthogonal nor diagonal views can expose the source volume. Its first water tile stays free of stones. That complete first tile is covered by a full-width, full-length, one-third-cube-high grass-and-earth cap, flush with the surrounding ground, so the water reads as emerging naturally from beneath a sheltered bank at the tile's downstream edge. The cap remains one clean, continuous piece without attached protrusions or cutouts. Beneath the cap, an irregular animated turquoise tint begins on the hidden riverbed and feeds a low turbulent surface whose displacement becomes visible downstream. The source never emits a vertical jet, tall plume, raised geyser mound, elevated steam, or particle cloud. Source churn remains blue-green throughout its animation and never forms a large near-white patch that could resemble ice. No portal ring, single bubble, wall opening, or side-facing seep overlay is added. Only the intended downstream opening and waterfall face remain open. Every internal landing adds animated cel-shaded foam bands on the receiving water, while edge falls continue below the deepest island underside, fade through their mist without a visible closing cap, taper into a non-uniform lower edge, and use volumetric droplets plus procedural mist and spray rather than flat trailing strips.
* Horizontal river cells may contain a small deterministic scattering drawn from multiple authored low-poly stone shapes using natural cool-slate, warm-gray, and dark-slate materials. Stone width, height, silhouette, rotation, and burial depth vary broadly, but every stone begins at or below the riverbed so it remains physically rooted rather than floating. Stones stay clear of bridges, waterfall source and landing cells, and cascade impact foam.
* An airborne hero who descends into an exposed river cell becomes submerged to the head and is carried downstream through each grid-aligned river turn. The fully grass-covered source cell is a real landing and walking surface at the surrounding terrain height; river-edge collision begins at its downstream boundary. The cover is structural river terrain rather than ordinary soil. A first dig attempt creates only a shallow opening, reveals several small embedded river rocks, and automatically ends after one shovel cycle; that source cover cannot be dug again or turned into a treasure hole, and the small blocked opening does not obstruct walking. Player movement cannot override the current. While carried, the exposed head uses a continuously animated panic performance with uneven scanning, short startled shakes, pitching, tilting, and a gasping mouth. A bridge is climbable only when its deck is no more than one world-height unit above the river surface. On approach to a climbable bridge, the current stops the hero wholly inside the exposed upstream river cell. At first contact the current action ends completely and a separate stationary railing-climb action begins: the head and torso emerge outside the bridge footprint, only the outstretched hands cross the boundary to catch the upstream railing, and the body lifts before pulling toward the rail and hopping over the fence onto the walkable bridge deck. Beneath any higher bridge the hero remains in the current and passes under it. Reaching the terminal waterfall instead carries the hero beyond the lip and transitions into the normal fall-death sequence.
* Regeneration variety currently comes from:
  * castle horizontal placement
  * castle row-band selection
  * entry-band selection
  * left/right side assignment
  * island ellipse parameters
  * hill ellipse parameters
* The current validator enforces:
  * one connected island
  * gate placement at the first playable boundary tiles
  * two-tile path width
  * equal-height path lanes, including matched half-block ramp profiles at grade-separated crossings
  * separate upper and lower route graph nodes where paths overlap in plan view
  * rejection of every four-way flat crossing outside the designated grade-separated crossing
  * dirt-filled ramp sides and full-width elevated approaches
  * walkable deck-top collision plus underside head collision without blocking the lower route
  * automatic two-lane bridge conversion only where neither lateral side reaches path-deck elevation
  * added or raised grass support cubes where a solid path has only one supported side
  * solid turn and merge landings that prevent 90-degree or branching bridge decks
  * reserved grass-topped ground beneath non-river bridge decks without vegetation or ground-cover placement
  * minimum spacing between parallel path bands outside merge zones
  * route reachability from every gate to the castle
  * castle entrance connection
  * rejection of isolated noisy high grass
* The current implementation still tends to produce visually smooth path families because branch routing is limited to straight inward runs plus one join.
* If future work adds top/bottom gates, multi-turn templates, or more expressive branch graphs, this section should be updated.

## 20. Required validation

Reject the map when:

* any tile uses a different projection angle
* tile edges do not align
* a tile is partly path and partly grass
* a path is not exactly two tiles wide
* a turn, junction, castle approach, or pipe interface widens the road to three, four, or more tiles
* paired lanes differ in direction, height, or slope
* a straight path position with no lateral support remains solid, or only one of its two lanes renders as a bridge
* a path becomes a bridge even though at least one lateral side has a supporting block
* a bridge turns 90 degrees, merges, branches, or forms an intersection
* a non-water bridge exposes bare earth beneath its deck or allows an object to spawn on its covered grass
* bridge fascia or rail borders show internal seams, overlapping faces, flicker, or fractional-zoom visual noise
* two parallel paths are separated by fewer than two grass tiles outside a merge zone
* a turn cuts diagonally through a tile
* a road boundary is rounded, chamfered, or bevelled into a non-orthogonal turn
* a slope uses stairs
* a slope uses too few tiles for its height difference
* a grade-separated ramp rises or descends more than half a block per tile
* an approach or exit narrows below two complete path tiles at a turn
* an elevated flat approach is hollow, rendered as a thin bridge, or is not filled to its path surface
* a grade-separated approach adds or raises a lateral support cube beside the two path lanes
* paths at different crossing elevations become connected in the route graph
* two routes form a four-way flat crossing outside the designated grade-separated crossing
* an actor intersects the deck while walking or jumping beneath a grade-separated crossing
* walking beneath a grade-separated crossing changes the camera rotation
* a grade-separated ramp, elevated approach, or crossing deck is missing either outer railing, or a sloped railing does not follow the ramp plane
* a gate is not on the first boundary path tiles
* a gate or gate-like structure appears in the middle of a path
* a path splits after merging
* an entry path does not reach the castle
* an ordinary path cell does not belong to a gate-to-castle traversal
* a path branch is disconnected, decorative, orphaned, dead-ended, or an unrelated loop
* an enemy route or direction arrow does not follow the quickest valid path-and-pipe graph toward lower remaining castle cost
* a debug direction arrow floats above, clips through, or fails to follow the plane of a sloped path tile
* a pipe is unpaired, occupies a path cell, does not face and connect to its two-lane path interface, or creates a widened route
* a pipe is represented as a half-pipe, cutaway tunnel, arch, cubist body, incomplete cylinder, or non-circular opening
* water has no valid source
* water flows uphill
* an island has more than two lava rivers, or contains lava while having more than two total rivers
* a waterfall has fewer than five upstream tiles
* a waterfall intersects terrain or another object
* grass elevation changes appear as random isolated noise
* trees occupy invalid or buildable cells
* a loot crate occupies an unreachable, non-flat, or reserved cell
* path tiles use a different angle or footprint from grass tiles
* terrain voxels use inconsistent cube dimensions
* regeneration always keeps the same island shape or castle position

## 21. Suggested tile data

```text
Tile(x, y, baseHeight, surfaceType, shape, direction)
```

Examples:

```text
Tile(12, 8, 2, PATH, SLOPE, NORTH)
Tile(7, 4, 1, GRASS, FLAT, NONE)
```

Invalid:

```text
Tile(12, 8, 2, PATH_AND_GRASS, DIAGONAL_WEDGE, NORTH_EAST)
```

Waterfall data:

```text
Waterfall(sourceTile, direction, upstreamLength, cliffTile)
```

Required:

```text
upstreamLength >= 5
```

Slope data:

```text
SlopeSequence(direction, startHeight, endHeight, tileCount)
```

Required:

```text
tileCount = abs(endHeight - startHeight)
```

Grade-separated crossing ramps instead require:

```text
tileCount = 2 * abs(endHeight - startHeight)
```

# Map Generator Rules

These rules are the canonical specification for any change to map generation logic, path generation, terrain shaping, water placement, or tile rendering. When updating map generation, treat this document as binding requirements rather than suggestions.

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
* It may never become one tile or three tiles wide.
* Both path lanes must remain adjacent.
* Both lanes must use the same direction, elevation, and slope profile.
* The full two-tile width must be preserved through:
  * straight sections
  * turns
  * slopes
  * bridges
  * merges
  * castle approaches
  * gate sections
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

## 6. Path turns

* Turns must use predefined two-tile-wide templates.
* Every turn uses only complete path tiles.
* Both lanes must remain continuous through the corner.
* Turns may visually use small bevels, but the logical tile layout remains square and grid-aligned.
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

## 9. Path elevation

* Flat path sections stay at one elevation.
* Elevation changes use continuous 45-degree ramps, not stairs.
* One slope tile changes elevation by exactly one block height.
* Both lanes must rise or descend together.
* A slope cannot turn, twist, or change direction midway.
* A slope cannot incline sideways across the path.
* Required slope length is:

```text
slope tiles = absolute elevation difference
```

* A rise of two blocks requires two consecutive slope tiles in each lane.
* After a slope, the path must remain flat for at least one tile before turning.
* Terraces are allowed as:

```text
slope -> flat tile(s) -> slope
```

## 10. Grass terrain

* Grass may be flat, sloped, terraced, or cliff-shaped.
* Grass elevation may vary more freely than path elevation.
* Terrain transitions must form readable hills, valleys, plateaus, terraces, or cliff bands.
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

## 19. Generation order

1. Generate island footprint.
2. Assign terrain heights.
3. Generate the path graph.
4. Expand every path into two lanes.
5. Apply turns and slopes.
6. Place gates and castle.
7. Generate water sources and flow.
8. Place waterfalls.
9. Reserve buildable grass.
10. Place trees.
11. Add decorations.
12. Validate the complete map.
13. Render only after validation passes.

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
* Entry paths currently use a simple route family:
  * one horizontal inward segment from the gate
  * one vertical join into the shared trunk rows when needed
  * one final shared horizontal trunk to the castle
* True multi-turn path templates are not implemented yet.
* Explicit curved branch templates are not implemented yet.
* The current merge model still uses one shared merge column for all selected entry paths.
* The current generator does not yet support branch-specific merge zones or re-splitting after merge.
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
  * flat equal-height path lanes
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
* paired lanes differ in direction, height, or slope
* two parallel paths are separated by fewer than two grass tiles outside a merge zone
* a turn cuts diagonally through a tile
* a slope uses stairs
* a slope uses too few tiles for its height difference
* a gate is not on the first boundary path tiles
* a path splits after merging
* an entry path does not reach the castle
* water has no valid source
* water flows uphill
* a waterfall has fewer than five upstream tiles
* a waterfall intersects terrain or another object
* grass elevation changes appear as random isolated noise
* trees occupy invalid or buildable cells
* path tiles use a different angle or footprint from grass tiles
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


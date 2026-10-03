# Authored castle base plans

The four JSON files are manual schematic transcriptions of the supplied drawings.
The original sheets are retained in `sources/` under the matching plan ID.
Coordinates approximate the drawing proportions; these are not architectural surveys.
The inconsistent stair label on castle 03's upper keep is recorded in the slot label;
its vertically aligned shaft is consistently named S1.

## Data contract

- North is negative z. Each `bounds` value is `[x, z, width, depth]`.
  The three large plans use a 100 × 60 schematic envelope at 0.5 metres per unit.
  `castle-demo-compact` uses actual metres: a 7 × 8 metre footprint and three-metre
  floor spacing. Its footprint is preserved rather than stretched to the map reservation.
- `levels[].spaces` describes room interiors, circulation, courtyards, terraces,
  wall walks and voids. A void must never receive a floor, ceiling or furniture.
- Every opening is explicitly authored on a room wall: `side`, `offset` from
  the wall's minimum x/z, `width`, `bottom` above its floor and `height`.
  Offset/width use schematic units; bottom/height use metres. Shared apertures
  may be described by both adjacent rooms. Consumers should merge coincident
  apertures, not select new positions. Door `swing` selects `inward` or `outward`
  (default). Blank opening arrays mean no openings.
- `staircases` describes fixed shafts and connected levels. `roofs` records
  footprint, elevation and shape. `entrance` references an authored door and
  bridge footprint. Optional stair `radius` controls the spiral independently
  of the floor opening; `landingProfile` selects the slower lower turn.
- A slot's `generator` is an existing room generator class name or null.
  Null preserves an unfurnished slot. Service/library mappings provide the
  currently available furniture; dedicated royal, barracks, armory, winch and
  kitchen generators can replace those bindings later without moving rooms.

## Generating room content

```js
import { CastleBasePlanGenerator } from "../CastleBasePlanGenerator.js";

const plan = await CastleBasePlanGenerator.generate({
  planId: "castle-03", // omit to use the pinned compact demo
  seed: "my-castle",
  unitMetres: 0.5,
  baseY: 3,
});
```

The compiler preserves every slot and opening, runs room furnishing in the bound
slots, and rejects furniture outside rooms or in door approaches/stair shafts.
Its output includes compiled spaces, rooms, door/window apertures, all staircases,
roofs, entrance and furniture. It never packs rooms or invents openings.
`await CastleBasePlanGenerator.plans` returns independent editable copies of the catalogue.

## Live integration

The compact demo is currently pinned for every seed, before planning its entrance
route. Seeds still control room content; selecting among plans is deferred. `CASTLE_FOOTPRINTS` only reserves the footprint.
All castle test fixtures store a seed and construction inputs, with no mode flag
or plan ID. `CastleGenerator.generate({ position, doors, seed })`
uses the pinned compact plan, including during live regeneration.
The public generator compiles the
selected plan into castle-owned walls, floors, roofs, doors, windows and furniture.
Masonry uses the same quarter-metre blocks and stone palette as the gates;
raised wall walks are supported by solid brick curtain walls.
Schematic footprints scale; the metric demo only rotates around its entrance. Opening centres
stay fixed. Door widths have a 0.75-metre gameplay minimum, and the exterior gate
matches the map's two-lane approach. Windows bypass inferred placement entirely.

Every shaft builds the existing spiral stair module between its specified levels.
The drawings' straight stair shapes and distinct roof profiles are approximated
with the existing stair and pitched-roof models. Void areas remain unfloored.
The public generator no longer dispatches to the legacy room-packing pipeline.
A preview fixture is available at /en/map/test_castle-base-plans.

For regeneration, compare matching ground/upper/roof panels in the source sheet,
edit the JSON in place, preserve stable slot IDs, and run:

```sh
node --test --test-isolation=none test/unit/game/generator/castle/castle-base-plan-generator.test.js
```

## Compact demo adjustments

The dimensioned game-constrained sheet is retained as the regeneration source.
The ground-floor study was removed at the user’s request, extending the west
vestibule. The main entrance was moved 1.75 metres left from the source position.
Other room boundaries follow that sheet. Door hinge orientation keeps the open
leaves out of the landing route. The stair-room west partition moves 1 metre and its south wall moves
0.5 metres in the basement and 0.75 metres above ground to clear the full hero beside the spiral. The shaft moves south by 0.25 metres for its basement approach. The corner keep and its roof
follow that adjustment; the outer 7 by 8 metre footprint stays fixed.
The spiral and floor opening fit inside that room.
Landing infill stays outside the walking lane to preserve headroom.
Each flight faces the nearest door on its starting floor, rounded to the nearest
cardinal direction. Compact flights make one full turn so their bottom entrance
and top exit face the same door side. The visible treads, rails, collision support
and floor opening rotate together; the room layout remains unchanged.
Each flight faces the nearest door on its starting floor, rounded to the nearest
cardinal direction. Compact flights make one full turn so their bottom entrance
and top exit face the same door side. The visible treads, rails, collision support
and floor opening rotate together; the room layout remains unchanged.

Verify door support and headroom with `compact-castle-door-clearance.test.js`, and
real hero traversal plus four exterior captures with `CompactCastleTraversal.cy.js`.

The marked ground-floor room now contains the throne and royal furnishings. Audience furniture follows the assigned room centre rather than the main entrance. The adjoining space remains open circulation. The connecting door moves toward the front of the throne room, so the route does not pass behind its dais.

The compact ground floor has a continuous structural slab beneath the room interiors and circulation seams. Terrain is excavated below its full quarter-metre thickness, preventing grass and earth strips from showing between floor sections. Stair openings remain cut from the slab.

Generated maps reserve the selected plan's rotated metric footprint plus one tile on each side. The compact castle therefore uses a 10 by 9 tile reservation instead of the legacy 16 by 28 area; island clearance and plateau shaping follow that reservation.

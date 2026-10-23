# Authored castle base plans

The four active layouts are: `castle-demo-compact`,
`castle-compact-service-wing`, `castle-rear-bell-tower` and `castle-tower-bridge`.
The compact reference sheets are retained in `sources/`.

## Data contract

- North is negative z. Each `bounds` value is `[x, z, width, depth]`.
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
  bridge footprint. Optional stair `radius` controls the stair footprint independently
  of the floor opening. Optional `flightGap` moves the flights outward, reserving
  centre space for a castle-brick divider while widening the upper floor opening.
  Flights use the exterior stone stair modules and materials.
- A slot's `generator` is an existing room generator class name or null.
  Null preserves an unfurnished slot. Service/library mappings provide the
  currently available furniture; dedicated royal, barracks, armory, winch and
  kitchen generators can replace those bindings later without moving rooms.

## Generating room content

```js
import { CastleBasePlanGenerator } from "../CastleBasePlanGenerator.js";

const plan = await CastleBasePlanGenerator.generate({
  planId: "castle-demo-compact", // omit for seed selection
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

The active layout list (`CastleBasePlanGenerator.layoutPlanIds`) contains the compact demo, service-wing alternative and rear round bell tower with spiral stairs, selected by seed before planning its entrance
route. Even/odd seed pairs select the same layout; odd seeds mirror all compiled spaces, openings, roofs, buildings, stairs and furniture about the entrance, preserving its position and direction. Named seeds use a stable hash; numeric strings retain numeric parity. Add future playable plan IDs to the ordered active list. `CASTLE_FOOTPRINTS` only reserves the footprint.
All castle test fixtures store a seed and construction inputs, with no mode flag
or plan ID. `CastleGenerator.generate({ position, doors, seed })`
uses the seed-selected plan and mirror orientation, including during live regeneration.
The public generator compiles the
selected plan into castle-owned walls, floors, roofs, doors, windows and furniture.
Masonry uses the same quarter-metre blocks and stone palette as the gates;
raised wall walks are supported by solid brick curtain walls.
Schematic footprints scale; the metric demo only rotates around its entrance. Opening centres
stay fixed. Door widths have a 0.75-metre gameplay minimum, and the exterior gate
matches the map's two-lane approach. Windows bypass inferred placement entirely.

Each shaft connects its specified levels with two straight stone flights and a
turning landing. Existing stone models form deep treads with flat Ammo collision
tops, allowing the hero to rest between steps. Risers stay within the automatic
step clearance, and open floor shafts provide headroom. Void areas remain unfloored.
The public generator no longer dispatches to the legacy room-packing pipeline.
A preview fixture is available at /en/map/test_castle-base-plans.

## Rear bell tower terrace

`castle-rear-bell-tower` opts its roof terrace into `GardenTerraceRoomGenerator`.
Even/odd seed pairs share a decorative family: pairs 0/1, 4/5, etc. produce the
royal garden; pairs 2/3, 6/7, etc. produce the weathered storybook court.
The round tower, spiral stairs, terrace link and hall footprint stay fixed.
Furnishings reserve the central two-metre tower approach and use normal map
objects, including open-sided imported pergola/canopy models and flower planters.
Use the **Royal garden (1)** and **Storybook (4)** HUD buttons on
`/map/test_castle-rear-bell-tower` to compare the two styles.

For regeneration, compare matching ground/upper/roof panels in the source sheet,
edit the JSON in place, preserve stable slot IDs, and run:

```sh
node --test --test-isolation=none test/unit/game/generator/castle/castle-base-plan-generator.test.js
```

## Compact demo adjustments

The upper south facade has a door near its west corner and three windows to its
east, each 1 metre wide and 1.5 metres tall with a 0.75-metre sill and
0.75 metres of masonry between consecutive openings. Both storeys
retain the same east/west footprint. This facade adjustment preserves the
existing brick palette and does not author banners or change the main entrance.

The dimensioned game-constrained sheet is retained as the regeneration source.
The ground-floor study was removed at the user’s request, extending the west
vestibule. The main entrance was moved 1.5 metres left from the source position, including
a 0.25-metre adjustment toward the throne room. Its bridge follows the door.
Other room boundaries follow that sheet. Door hinge orientation keeps the open
leaves out of the landing route. The stair-room west partition moves 1 metre and its south wall moves
0.5 metres in the basement and 0.75 metres above ground to clear the full hero beside the staircase. The shaft moves south by 0.25 metres for its basement approach. The corner keep and its roof
follow that adjustment; the outer 7 by 8 metre footprint stays fixed.
The staircase and floor opening fit inside that room.
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
`flightShift` moves both straight flights toward their door in metres while keeping the back edge of the turning landing fixed. The compact plan uses 0.1 m, enlarging that platform by the same amount so the extended central divider retains a walking route.

## Seed selection

Seed pairs 0/1 select the compact demo, 2/3 select the service wing, and 4/5
select the rear bell tower with spiral stairs. The sequence repeats every six
numeric seeds; odd seeds mirror the layout around its entrance.

## Service-wing alternative

`castle-compact-service-wing` has an eight-by-eight-metre main block and a
watchtower attached midway along its east side. The total authored envelope is
12.25 by 8 metres. The tower projects from the side wall; the original south
entrance retains its unobstructed two-lane approach.

The shared ground-floor hall opens directly into the tower. The throne room
and servant quarters retain separate doors. Entering the basement westward from
the side-tower stair door leads directly into the kitchen. Terrace equipment
storage is on the right (north), with its own connecting door and stored sunbed,
tea table, chair and tea set. The remaining western area is one royal bedroom,
connected through the kitchen's west door. The saved `ladder-castle` fixture carries a
rebuilt plan, rather than its former empty passage. Connected building envelopes omit
shared exterior walls while preserving room partitions and projecting floors.

One west-facing stair shaft uses matching flights and landings through every
storey. Its flights meet the side walls and retain an aisle to the final ladder.
The wall-mounted oak ladder reaches the battlement crown through a clear hatch.
`roofAccess` records model placement, rotation, and supported lower/upper
landings separately. Preparation publishes a normal `Ladder` map object.
E transfers between the landings instantly; a climbing animation is not authored.
The ladder wall remains unfurnished.

The service-wing lookout and upper landing use paired 0.25 by 0.9-metre
amber-lit defensive slit windows on their north, south, and east faces. The
crown remains an open flat platform with alternating merlons and embrasures.
Its signal station has a blue crest banner, a separate blue flag, and an open
timber alarm-bell frame; it has no shelter or fire beacon. Map preparation
publishes the bell and flag through ordinary map objects, away from the hatch.
Approach the bell on the crown and press E to grab and pull its hanging string.
The hero enters a ringing action, with synchronized `RingBell` and `Ring` clips
and a strike sound at the downward pull. Another ring is available after release.
Use `/map/test_signal-tower?camera-test` for the rooftop, opposite-side, and
interior views, the beside-bell teleport, and live strike count.

The authored ladder measures 0.925 by 3.7 by 0.2 metres, uses a bottom-centred
pivot, and includes 0.7-metre handholds above the climb. Its decoded GLB bounds
are static vertex bounds, with no runtime scaling correction required.

The service-wing ground-floor cross hall and entrance circulation now form one rectangular vestibule. Its original main entrance and west window remain at the same coordinates; a single room generator and timber finish cover the full arrival area.
The crown ladder ends below the roof surface. A separate `Hatch` map object owns the framed lid, handles, collision and lock. `Ladder.hatchId` optionally connects the two objects; `opening` describes rail clearance without owning the hatch. Unlocked crown access opens temporarily during climbing. Pitched blue roofs receive a wall ladder on the occupied floor below and a locked attic hatch with an iron rim lock and a separate fixed keeper. Placement preserves furniture, apertures and stair clearance; the ceiling has a real opening sealed by the independent lid. Both objects can also be authored alone.

## Tower bridge entrance

`castle-tower-bridge` (seeds 6/7 in the first selection cycle) moves the round
spiral tower to the approach side. Its ground door is the castle entrance and
path endpoint; its opposite upper door leads across a raised bridge to the roof
terrace. The far stair tower provides the only descent into the hall. The ground
corridor and the hall's former exterior entrance are absent.

`roundTower.terraceDoorSide` selects NORTH or SOUTH independently of the south
ground entrance. `entrance.doorOwnedByRoom` keeps the path endpoint while suppressing the
castle main-gate assembly: the round tower supplies its normal 1.2-metre door.
Both options preserve existing tower defaults. The entrance aperture is authored as a small courtyard threshold; the
circular tower owns its surrounding shell and floor.

Open `/map/test_castle-tower-bridge` for the two-tile monster route beneath the
bridge, ending at the tower door. HUD buttons expose the entrance, bridge,
terrace, descent tower and hall, plus the mirrored variation.

The optional entrance `approach` lists orthogonal `[inward, lateral]` offsets in metres from the door center. The map generator reflects lateral offsets with the castle and reserves two-tile paving along this shared final route. Tower-bridge approaches pass beneath the bridge before circling back to the ordinary tower door.

`entrance.approachRamp` raises the last two approach stations to the castle floor, followed by a flat 2x2 exterior landing at the door bottom. It uses ordinary terrain slope tiles and removes the need for a separate exterior stair flight.

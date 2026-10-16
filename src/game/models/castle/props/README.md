# Castle props

## Central vestibule furniture

Wide vestibules choose either a freestanding double-sided upholstered bench or
an adventurer's map table, centred on a burgundy rug. Each room gets only one
centre island. The seed alternates variants between full base-plan cycles,
keeping mirrored pairs consistent. The room generator reserves at least 0.7 m
around nearby floor furniture, plus the existing door and stair approaches.
Narrow circulation halls keep their arrival runner.

Both new models were generated through the authenticated Tripo Studio H3.1
text-to-model UI on 2026-10-14, for 30 credits each (60 total):

| Model | Tripo task | GLB XYZ dimensions | Triangles |
| --- | --- | --- | --- |
| vestibule-island-bench | 1cbaf942-32dd-47a4-8b70-ac182ea5394e | 1.80 × 1.05 × 1.05 m | 3,846 |
| vestibule-map-table | c56e5cab-664e-4b5c-ad2f-3ebaf8ba78fe | 1.80 × 1.00 × 1.00 m | 4,715 |

The bench was replaced from the user-approved isolated reference later that day
for 30 additional credits (90 total including the retired first bench). It has
horizontal backrest planks, capped square posts, six separate burgundy cushions,
a gold heraldic drape and no armrests. Four independent brown and olive satchels
fill the wide bench's storage space: a near-end pair and two long-side bags.
They are not baked into the bench.
These editable Blender assets replace the rejected rigid cases with a
reference-guided Tripo soft duffel: bulging leather body, rounded overlapping
flap, two thick straps and dark buckles, without a bedroll or case handle.
Task `2859c8ee-bf5e-427f-b6e0-2bdc2c47840a` used 30 approved credits.
Each measures 0.60 × 0.30253 × 0.36434 m with a centred footprint, 4,784 triangles
and packed 1024 px textures. The olive variant recolors warm leather pixels
locally while preserving texture detail and neutral metal.
The source is scaled uniformly by 0.6 to preserve its proportions. The near-end
pair sits at -0.85 m along the bench, across offsets ±0.285 m at scale 0.9.
The long-side pair sits at +0.45 m along the bench, across offsets ±0.40 m.
Wide seating layouts stretch the bench to 2.70 × 1.20 × 1.20 m (XYZ), place
the long-side bags at scale 1, and use a 4.0 × 2.5 m rug. The console sits beside
the arrival end of the seating, with at least 0.7 m between their footprints.
Seating shifts 0.65 m toward the far-wall chest, keeping that end gap around 1 m
instead of spreading the furnishings evenly along the room. The central layout
replaces the older wall bench, boots and stick stand rather than duplicating them.
Smaller rooms retain the compact bench dimensions and scale-0.8 luggage.
The far-wall luggage chest uses a vertical stretch of 0.82 (18% lower) and
mounts its measured rear plane directly to the wall; its separate travel kit
follows the lowered lid. The entrance window bay uses a low library side table
with a small planter, boots underneath and a reduced stick stand beside it.
These objects retain doorway clearance and stay below the window glass.
A blue shield and crossed swords fill the adjacent wall above a second,
taller storage chest. Folded linens and a portable table lantern sit on its lid;
the group is mounted flush to the wall and retains its supported details.
The long wall also receives a console using the `Table` writing-desk variant,
with its measured local rear plane (`wallMountBack: -0.275`) touching the wall
after placement repair; supported tabletop objects follow that adjustment.
The console has separate coat hooks, a portable table lantern and small planter. Supported objects
retain their group relationships during placement repair.

The adjacent `.blend` files retain editable Tripo meshes and packed 1024 px
textures. Calibration is baked once into these sources: centred XZ footprints,
grounded pivots, long axis along X, glTF +Y up, and runtime scale 1. The table
includes its parchment map and wooden markers. Authored mesh collision retains
the open space beneath the furniture. Fresh GLB imports, exact vertex bounds,
and six-angle renders were checked. Provider provenance, source/output hashes,
dimensions, and prompts are retained in `vestibule-islands-provenance.json`.
Scratch import scripts and multiview evidence are in ignored
`tmp/vestibule-islands/`. Use `/map/test_vestibule-arrival` and its PlayCanvas HUD
controls for repeatable first-person views from both ends, entrance door states,
and a castle overview.

## Vestibule furnishings

The stick stand retains its open oak-stave holder and matte iron hoops. Its two
walking sticks and folded navy umbrella were regenerated independently in Tripo
Studio H3.1 on 2026-10-12 using isolated original-style image references. Accepted
jobs: `975b165c-703c-4f76-82a7-106de6063936` (tall stick),
`45fa27e5-4f1e-43c3-a7cd-72ee1c345da8` (short stick), and
`89bfba68-372c-41e5-8ed7-bffa501a5e4c` (umbrella). Three initial text candidates
and three image-guided generations used 180 Studio credits in total.
The adjacent source and GLB contain four independent named meshes: the open
holder and three complete contents, grounded inside it. Each content mesh
records its provider job ID. Textures are packed and exported at up to 1024px.
Import receipts, reference renders and fresh-import previews are in ignored
`tmp/stick-holder/`.

`vestibule-bench` and `vestibule-cloak-rail` were generated from isolated castle-style
concepts using Tripo Studio H3.1 on 2026-10-10 (60 credits total). Task IDs:
`8417a73a-877a-49b0-b49e-a65175894643` and
`3d80f078-fdc3-444c-84c4-d1f71312954e`. Reference PNGs are saved under the user's
Clairvoyance `pictures/generated` directory with matching basenames.

The editable adjacent Blender sources preserve Tripo geometry and packed
1024-pixel textures. Models use bottom-center pivots, glTF +Y up and +Z facing.
The bench is 1.30 × 0.82 × 0.50 metres (3763 triangles); the cloak rail assembly
is 0.85 × 0.80 × 0.16 metres (4616 triangles). Both pass fresh GLB import checks.
Import scripts and front/rear previews remain in ignored `tmp/vestibule`.

`VestibuleRoomGenerator` furnishes the compact plan's two circulation slots.
`VestibuleRoomMapObjects` publishes its props through normal map objects, with
authored mesh collision, mirrored placement and replacement on regeneration.
The embroidered rug, royal crest and bronze lantern reuse existing models;
`VestibuleLantern` adds a warm point light to the existing flame effect.

Twenty-one textured Tripo Studio models generated from the isolated PNG references
in `tmp/items`, through the Opera browser UI. The batch used 600 Studio credits;
no Tripo generation API or paid regeneration was used. Job IDs and import receipts
are retained in `tmp/tripo-items` for this local session.

Each adjacent `.blend` is the editable source for its `.glb`. Textures are packed
into the source and embedded in the GLB, with a maximum dimension of 2048 pixels.
Models use metres, +Y up in glTF, and a grounded, horizontally centered pivot.
Facing follows the original generated model; map definitions may specify yaw in
degrees through `rotation`.

Each prop has its own folder under `src/game/objects/` and registers through
`MapObjectFactory`. Shared lifecycle code lives in `shared/AbstractCastleProp.js`.
Place them in the map's `objects` array using `id`, `object`, `tile`, `position`,
and optional `rotation`, as shown by `castle-props-{1,2,3}.json` under map tests.
They are static props with Ammo triangle-mesh collisions that preserve openings
under tables and between chair arms. Candles and wall lanterns include textured
flame/glow geometry. Entrance lanterns use translucent amber glass with a separate
runtime `Fire` particle flame inside the housing, with panes supplied by `LanternGlass`.

The entrance lantern was remade from the unlit four-finial concept in Tripo
Studio H3.1 on 2026-10-10, using 30 credits (task
`f76ac5e2-0536-49f1-a0f7-372348e70e46`). Its bronze frame and frosted glass have
no baked flame. Matching ornaments finish all four bottom corners. The source
contains packed textures up to 2k, normalized to 0.187 × 0.450 ×
0.257 metres in glTF XYZ, with its wall bracket facing -Z. The entrance uses
1.6 times that height and 1.38128 times the horizontal dimensions. Glass panes
transmit the view of the internal particles; no flame is drawn on their surface.
The bronze frame renders from both sides, and each glass pane is a separate
mesh so transparent surfaces sort independently when viewed from the side.
The exposed interior has clean rectangular panes, straight bronze corner rails,
and flat floor and ceiling surfaces, replacing warped generated faces.
Warm yellow translucent panes have a continuous fine square frosted texture,
without dividing bars or outlines, retaining a visible internal flame.

Verification: the focused `CastleProps.cy.js` spec loads all three maps, checks
every prop has render meshes, a grounded bounding box, a native Ammo body and a
successful ray hit against its actual surface, and captures both map
views plus an individual close-up for every prop. Offline vertex inspection also
confirms static, unskinned, uncompressed geometry with zero ground offset.

## Library books

`open-reading-book` and `closed-shelf-book` were generated from matching isolated
castle-style concepts through Tripo Studio H3.1 on 2026-10-10, using 60 credits.
Tasks: `df38cf07-78c8-4030-a524-b0ea9bfb1134` (open) and
`5176a027-d76c-42ab-b45e-f54c9b4cf4eb` (closed). Concepts are saved in the user's
Clairvoyance `pictures/generated` directory as `open-reading-book.png` and
`closed-shelf-book.png`. Local normalization receipts and scripts are in ignored
`tmp/book-assets`.

Both adjacent Blender sources contain packed 1024-pixel textures. The open book
is 0.36 × 0.227 metres with a bottom-center pivot for desktop placement. The
upright shelf book is 0.065 × 0.26 × 0.20 metres in glTF XYZ, with its spine
facing +Z. Its mesh is reduced to about 1500 triangles for repeated shelf use.
`Book leather` is neutralized for cover-only runtime tint;
`Book parchment and brass` retains its original texture and color.

`ShelfBooks` replaces the bookcase's embedded books at runtime and varies
width, height, depth, and six leather colors with the shelf's seeded random
source. Upright volumes touch their neighbors, align at the back, and are grouped
by similar size and cover color. The shallow top compartment holds two supported
horizontal stacks rather than miniature upright books. Variations remain
supported on the measured plank tops. Library desks
place `OpenReadingBook` through the normal map-object registry.

## Library accessories

Generated isolated reference images first, then uploaded them to Tripo Studio
H3.1 on 2026-10-10. Three image-to-model jobs used 90 credits total:

| Object | Model | Task | glTF XYZ metres | Triangles |
| --- | --- | --- | --- | --- |
| LibrarySideTable | library-side-table | 61b0a163-dfe4-4bed-b542-983937366882 | 0.684 × 0.550 × 0.616 | 4392 |
| StepStool | library-step-stool | b1a307aa-aea4-4f31-9f95-e6f8e19c9854 | 0.517 × 0.400 × 0.488 | 4300 |
| ParchmentBundle | library-parchment-bundle | 3ab1000d-7531-43c8-8e0a-3cc684c9bd3f | 0.300 × 0.134 × 0.156 | 4674 |

References are saved as matching PNG filenames under the user's Clairvoyance
`pictures/generated` directory. Raw downloads remain in Downloads. Each editable
Blender source preserves the generated geometry and packed textures, reduced to
1024 pixels. Exports use metres, glTF +Y up, and a bottom-center pivot. The
normalization script, request prompts, and fresh-import receipts remain in ignored
`tmp/book-assets`. All three classes register through `MapObjectFactory` for
placement through normal map objects, inheriting authored mesh collision.

Closed `Book` objects reuse `closed-reading-book.blend`: horizontal books measure
0.260 × 0.040 × 0.200 metres in glTF XYZ. Library shelf-top stacks contain
three independent closed books with touching faces and red, green, and brown
leather covers. No separate stack object or model is needed.

`LibraryRoomFurnishing` places stacks and scroll bundles on measured shelf tops,
a closed book on the side table, and a floor step stool. It reserves the desk
and shelf approaches before optional reading furniture, uses ordinary wooden
chairs, and omits groups that cannot fit safely in small rooms. Focused checks
cover support, non-overlap, repeatability, and connected walking routes across
60 standard room seeds.

## Vestibule arrival accessories

`vestibule-banner.blend/.glb` replaces the flat residential pennant in this room.
It matches the approved screenshot mockup with navy cloth folds, an inset gold
border, a shallow pointed hem, a five-tower embroidered castle with windows and
an arched gate, and an oak rod supported by three fabric tabs. Its top-center
pivot preserves existing map placement. The gold border, castle, windows and gate
use a packed 1024 × 1536 cloth albedo texture, mapped onto both sides of the folded
cloth. They have no overlapping embroidery geometry. The rod and fabric tabs
remain modeled parts. Other rooms retain their original banner.

Four isolated game-style references were converted with Tripo Studio H3.1 on
2026-10-11, using the approved 120 credits (30 per model).

| Model | Tripo task | glTF XYZ metres |
| --- | --- | --- |
| vestibule-painting | 54e8b168-d8c0-4596-97e6-ee087f2953af | 1.05 × 0.78 × 0.08 |
| vestibule-travel-kit | d94b1aa4-a848-47cf-ba7e-e9e333ddcf53 | 0.48 × 0.45 × 0.30 |
| vestibule-boots | 37ba755b-d50e-45fb-b7e4-68f096a3e4e6 | 0.40 × 0.28 × 0.32 |
| vestibule-stick-stand | 557f1d3b-35aa-428f-abe5-a05b4cfaf637 | 0.36 × 1.05 × 0.36 |

References are saved as matching `-reference.png` files in Clairvoyance's
`pictures/generated` directory. Adjacent editable Blender sources have packed
1024-pixel textures and bottom-center pivots. Each fresh GLB import was checked
for finite geometry, grounded bounds, intended dimensions, and fewer than
10,000 triangles. The painting landscape is baked onto a thin recessed canvas
inside a complete oak frame, with no scenery protruding behind its edges.
The travel kit rests on the measured bench seat, rather than the
bench's overall bounding-box height.

The room reuses the existing wooden storage chest and royal blue banner.
Paired cloak rails share the bench wall; the painting occupies the opposite
wall's clear pocket. The red runner is stretched along the arrival aisle.
All props enter through registered map objects. Focused generator tests cover
both mirrored layouts, door/window approaches, stairs, and cramped rooms.

`../../rug/vestibule-runner.blend/.glb` is a separate refinement of the existing castle
rug, matching the approved mockup's double gold border, repeating leaf diamonds,
crimson inset, and short fringe. Its measured glTF dimensions are
1.300 × 0.0306 × 3.300 metres, with a grounded center pivot and a single mesh
node. Placement varies its length with the room while retaining its 1.3-metre
width. Aligned vestibule sections publish one continuous carpet, reaching to
within six centimetres of the corridor ends, including the entrance section.
The runner has no rigid collision surface;
the castle floor supplies support, so door contact queries cannot catch its
embroidery or fringe. Thin floor coverings may pass through door
approaches; furniture still reserves those approaches. Other rooms keep the
original rug asset.

Window bays reuse the bench and a small terrace planter.
All benches retain the full 0.82-metre backrest height; window benches shorten
only their horizontal dimensions.
These groups stay below the measured window sill and outside door and stair
approaches. One travel kit sits on the chest below the painting, and one pair
of boots remains by the main coat bench. All benches stay free of bags.
Long rooms can fill multiple window
bays; intersecting furniture groups are omitted. No additional Tripo jobs were
submitted for this refinement.

The cloak rail contains `Rail wood and pegs`, `Cloak A`, and `Cloak B` in its
editable source. The wooden board and four pegs were rebuilt with a portable
oak grain texture to remove embedded garment fragments at empty hooks. The
complete Tripo cloaks have a neutral fold texture for per-instance tinting. A stable random
seed from the map object ID selects one or two cloaks, occupied hooks, and six
muted fabric colors. Two cloaks on one rail use different colors. Runtime
placement is applied to both visual and collision model parts before Ammo
receives the mesh. Instance materials are cloned and released with the prop.
The later cloak replacement is a complete separate asset in
`vestibule-hanging-cloak.blend` / `.glb`; its intact copies replace the cut-out
garments in the rail assembly. It was generated from the neutral standalone
cloak reference with Tripo H3.1 task `0d7ce5b7-0dc0-4121-9c9a-1c036354d524`
for 30 newly authorized credits. Its hanging loop is aligned to the pegs.

`vestibule-armor-display.blend` / `.glb` is a complete empty suit of armor on a
narrow oak base, 0.65 × 0.4 × 1.75 m. Tripo H3.1 task
`b4a9d987-9428-433e-ba72-5103fc0ead08` used another 30 authorized credits and the
simplified game-style armor reference. The room generator places one beside
the painting on the spacious side opposite the stairs door, only when its
footprint clears furniture, openings and stairs. All room openings are compiled
before furnishing so doors authored by neighboring rooms also reserve clearance.
Its packed base-color texture uses warm grey steel, brighter golden brass
fasteners, warm leather joints and an oak base. The matte finish preserves the
room's stylized shading; this color refinement keeps geometry and bounds intact.
Both replacement assets retain packed textures capped at 1024 pixels and were
validated after fresh GLB import.

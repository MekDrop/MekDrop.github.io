# Castle props

## Vestibule furnishings

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

The classes in `src/game/objects/castle-props` register through `MapObjectFactory`.
Place them in the map's `objects` array using `id`, `object`, `tile`, `position`,
and optional `rotation`, as shown by `castle-props-{1,2,3}.json` under map tests.
They are static props with Ammo triangle-mesh collisions that preserve openings
under tables and between chair arms. Candles and wall lanterns include textured
flame/glow geometry. Entrance lanterns use translucent amber glass with a separate
runtime `CastleFire` particle flame inside the housing, supplied by `LanternFire`.

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

`BookshelfBooks` replaces the bookcase's embedded books at runtime and varies
width, height, depth, and six leather colors with the shelf's seeded random
source. Upright volumes touch their neighbors, align at the back, and are grouped
by similar size and cover color. Compartment clearance determines upright rows or horizontal stacks; taller cases
repeat authored planks and use slimmer shared dividers at connected joins. Variations remain
supported on the measured plank tops. Library desks
place `OpenReadingBook` through the normal map-object registry.

## Library accessories

Generated isolated reference images first, then uploaded them to Tripo Studio
H3.1 on 2026-10-10. Three image-to-model jobs used 90 credits total:

| Object | Model | Task | glTF XYZ metres | Triangles |
| --- | --- | --- | --- | --- |
| LibrarySideTable | library-side-table | 61b0a163-dfe4-4bed-b542-983937366882 | 0.684 × 0.550 × 0.616 | 4392 |
| LibraryStepStool | library-step-stool | b1a307aa-aea4-4f31-9f95-e6f8e19c9854 | 0.517 × 0.400 × 0.488 | 4300 |
| ParchmentBundle | library-parchment-bundle | 3ab1000d-7531-43c8-8e0a-3cc684c9bd3f | 0.300 × 0.134 × 0.156 | 4674 |

References are saved as matching PNG filenames under the user's Clairvoyance
`pictures/generated` directory. Raw downloads remain in Downloads. Each editable
Blender source preserves the generated geometry and packed textures, reduced to
1024 pixels. Exports use metres, glTF +Y up, and a bottom-center pivot. The
normalization script, request prompts, and fresh-import receipts remain in ignored
`tmp/book-assets`. All three classes register through `MapObjectFactory` for
placement through normal map objects, inheriting authored mesh collision.

`ClosedReadingBook` and `LibraryBookStack` reuse `closed-shelf-book.blend`:
horizontal books measure 0.260 × 0.040 × 0.200 metres in glTF XYZ. The stack
contains three touching books, for a total height of 0.120 metres, with red,
green, and brown leather. Both have editable adjacent Blender sources and
registered object classes. No additional Tripo generation was used.

`LibraryRoomFurnishing` places stacks and scroll bundles on measured shelf tops,
a floor step stool, and a candle stand beside the single writing desk. Shelf tops
vary between bare, books, parchment, and combinations. Remaining suitable wall
space receives additional bookcases. Door and shelf approaches stay clear.
The candle stand uses animated castle torch fire, with its baked flame removed
from the adjacent Blender source and GLB. Focused checks
cover support, non-overlap, repeatability, and connected walking routes across
60 standard room seeds.

## Vestibule arrival accessories

`vestibule-banner.blend/.glb` replaces the flat residential pennant in this room.
It matches the approved screenshot mockup with navy cloth folds, an inset gold
border, a shallow pointed hem, a five-tower embroidered castle with windows and
an arched gate, and an oak rod supported by three fabric tabs. Its top-center
pivot preserves existing map placement. Other rooms retain their original banner.

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

`vestibule-runner.blend/.glb` is a separate refinement of the existing castle
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

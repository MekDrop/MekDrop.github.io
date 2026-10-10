# Castle props

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
under tables and between chair arms. Candles and lanterns include textured
flame/glow geometry. Interactions and dynamic light emitters are not implemented.

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

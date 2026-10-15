# SpearRack

Place a standalone rack through the map's `objects` array:

```json
{
  "id": "armory-spears",
  "object": "SpearRack",
  "position": { "x": 0, "y": 1, "z": 0 },
  "length": 1.6,
  "width": 0.75,
  "height": 1.2,
  "spearSeed": 42
}
```

Position is the bottom center. Dimensions are local metres before `scale`,
`stretch`, and rotation, like FirewoodStack. Defaults preserve the original
0.5 × 0.25 × 1.2 metre envelope. All lines share one plinth, iron-banded
corner posts, upper end cross-members and diagonal end braces. Long racks add
shared intermediate supports at intervals no greater than 1.8 metres.
Increasing `length` adds individually placed spears along local X at roughly
0.18 metre spacing while extending the same connected frame.
Increasing `width` adds parallel lines along local Z when they fit (one per
0.25 metres). `height` controls vertical size. Seeded variation changes spear
heights without misaligning the frame. Small areas scale parts to fit.
Each shaft rests on an inset butt socket and occupies an open rounded guide
slot; it does not pass through a solid rail. Collision uses exactly the same
assembly. Rails, bases, posts, braces, guides, sockets and spears are
separate authored parts in `src/game/models/spear-rack/spear-rack.blend` and
its adjacent GLB, following the Bookshelf approach to resizing structural parts.
The Blender file packs its timber texture. `models/spear-rack/concept.png`
records the visual target; `reference_notes.md` distinguishes documented
historical storage from the proposed multi-row frame. This is a historically
informed game design, not an exact reconstruction of a specific surviving rack.

Earlier definitions using `width` along X and `depth` along Z remain supported
when `length` is absent. New definitions should use `length` and `width`.

The seed defaults to the object's id. Invalid dimensions or layouts exceeding
4096 parts produce an empty rack. A sample is available on
`/en/map/test_object-previews`.

# FirewoodStack

Author the pile through a map's `objects` array:

```json
{
  "id": "hearth-wood",
  "object": "FirewoodStack",
  "position": { "x": 0, "y": 1, "z": 0 },
  "width": 0.9,
  "depth": 0.7,
  "height": 0.35,
  "firewoodSeed": 42
}
```

Position is the bottom center. Width, depth and height describe the local area in
metres before prop scale/stretch and rotation. Defaults retain the old pile's
0.269 × 0.38 × 0.2433 metre envelope. Individual authored logs form narrowing,
staggered courses, with each upper log cradled between two below it. Seeded
variations in mesh selection, length and uneven ends add variation. Collision uses the same
layout. The seed defaults to the object's id; set `firewoodSeed` to reproduce a
layout across different objects.

Nonpositive/nonfinite dimensions and layouts exceeding 4096 logs produce an empty
pile. The normal `/en/map/test_object-previews` route contains a sample pile.

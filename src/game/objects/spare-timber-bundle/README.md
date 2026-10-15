# SpareTimberBundle

Place upright spare boards through the map's `objects` array:

```json
{
  "id": "stored-timber",
  "object": "SpareTimberBundle",
  "position": { "x": 0, "y": 1, "z": 0 },
  "width": 0.24,
  "depth": 0.127,
  "height": 0.72,
  "timberSeed": 42
}
```

Position is the bottom center. Dimensions are local metres before prop scale,
stretch, and rotation. Defaults are 0.08 × 0.127 × 0.72 metres. Authored board
meshes use seeded variations in width, thickness, length, spacing, yaw, and lean.
Each board remains grounded within its allotted space to avoid intersections.
Collision uses the same placement. The seed defaults to the object's id.

Nonpositive or nonfinite dimensions and layouts exceeding 4096 boards produce
an empty bundle. A sample is on `/en/map/test_object-previews`.

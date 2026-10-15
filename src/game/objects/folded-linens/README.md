# FoldedLinens

Author linens through a map's `objects` array:

```json
{
  "id": "linen-store",
  "object": "FoldedLinens",
  "position": { "x": 0, "y": 1, "z": 0 },
  "width": 0.7,
  "depth": 0.5,
  "height": 0.48,
  "linenSeed": 42
}
```

Position is the bottom center. Dimensions describe the local area in metres,
before the usual prop scale/stretch and rotation. Defaults retain the authored
0.3 × 0.22 × 0.16 metre bundle. Larger areas contain courses of complete authored
bundles; the model is a single mesh, rather than separate towels. Small areas
scale the bundle down to fit. Seeded offsets and half-turns vary the placement;
each vertical column shares a footprint so upper courses stay supported.

The seed defaults to the object's id. Rendering and authored mesh collision use
the same layout. Nonpositive/nonfinite dimensions and areas exceeding 4096 bundles
produce an empty pile. `/en/map/test_folded-linens` provides a focused sample
stack; the shared `/en/map/test_object-previews` fixture also includes it.

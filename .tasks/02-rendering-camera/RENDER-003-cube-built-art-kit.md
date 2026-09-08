# RENDER-003 — Build the original cube-art visual kit

- **Priority:** P1
- **Depends on:** WORLD-002, RENDER-001
- **Touches:** `src/game/rendering/`, `src/assets/game/`, `public/`, asset-license records

## Goal

Make every world element read as part of one cheerful, cube-built floating-island style while remaining original and legible.

## Work

- Define a cohesive palette/material kit for grass, soil, path, cliff/underside, sky, water, bridges, gates, castle, pipes, build pads, towers, and decorations.
- Build structures from reusable grid-aligned cube/voxel primitives or original sprites that share the map projection.
- Render every earth/terrain block from one identical cube primitive; never stretch blocks to cover multiple grid cells or use half-sized terrain cubes.
- Give pipe pairs clear colors/symbols and visible entry/exit orientation without borrowing copyrighted graphics.
- Use complete smooth round green, flared-rim platform-game elbow pipes with full cylindrical bodies and horizontal ground-level circular mouths facing their adjacent path interfaces. Never use half-pipes, cutaway tunnel shells, arches, or cubic pipe bodies. Pipe footprints and facing stay grid-aligned; entry gates remain visually distinct boundary arches.
- Make paths visually distinct at all heights while preserving full-cell ownership and exact two-tile width.
- Draw every path top face with the identical isometric diamond/parallelogram polygon, axis angles, orientation, scale, and footprint used by grass. Change material/color only; never draw rectangular top-down paving or a free-angle road overlay.
- Add build-pad and blocked-pad visual states that remain readable under entities.
- Establish nearest-neighbor asset rules, pixel density, texture naming, and loading manifests through `AssetsManager` or PixiJS bundles.

## Acceptance criteria

- No structure uses a contradictory front/top perspective or floats above an unrelated grass tile.
- Grass and path edges align corner-for-corner on the same projected grid at every turn and elevation.
- All surface, cliff, soil, and underside earth cubes share the same modeled dimensions and align edge-to-edge.
- The castle, pipes, tower types, build pads, paths, and enemies are distinguishable at the fixed camera scale without relying only on color.
- All shipped assets are original, appropriately licensed, or generated with recorded provenance.
- Regenerated islands look varied without losing visual consistency.

## Verification

- Capture an art-kit showcase seed and compare readability in normal, grayscale, and small-screen views.

# Object data cache

Run `npm run cache:objects` to bake reusable object data. A matching cache entry
bypasses its generator; an absent, failed, or stale cache uses normal generation.
The browser never needs filesystem access. Vite packages the JSON shards as
separate asynchronous chunks for SPA and SSG builds, including generation workers.

```sh
npm run cache:objects
npm run cache:objects -- --object trees,bushes
npm run cache:objects -- --object books,bowls,roof,stairs
npm run cache:objects -- --object planters,wood-stacks
npm run cache:objects -- --catalog scripts/object-cache/catalog.json
```

Generated files live under `src/game/cache/generated/`, which is Git-ignored:

```text
generated/
  manifest.json
  trees/<content-hash>.json
  bushes/<content-hash>.json
  books/<content-hash>.json
  bowls/<content-hash>.json
  planters/<content-hash>.json
  firewood-stacks/<content-hash>.json
  timber-bundles/<content-hash>.json
  roofs/<content-hash>.json
  spiral-stairs/<content-hash>.json
  straight-stair-surfaces/<content-hash>.json
  straight-stair-treads/<content-hash>.json
  straight-stair-walls/<content-hash>.json
```

Each file contains exactly one variant, with a content-hashed filename; unrelated
variants never share a file. Files are bounded to 128 KiB. Oversized individual variants are fragmented
and reassembled only when every part loads successfully. The small manifest tracks
source/model fingerprints and filenames. Source changes invalidate stale artifacts
at development/build time. Content hashes make unchanged files stable across bakes.
Consumers receive independent data copies; gameplay state and entities are never
shared through the cache.

## Baked data

| Type | Cached data |
| --- | --- |
| Trees and bushes | Merged collision boxes for every authored type and remaining damage-row state; visuals already use authored GLBs |
| Books | Seeded shelf-book packing layouts; IDs, world positions, and facing are applied per shelf |
| Bowls | Ammo-settled item poses, keyed by ordered item definitions; shell/item entities and materials retain normal ownership |
| Planters | Seeded local boxwood foliage positions, keyed by object ID and authored positions |
| Wood stacks | Firewood log and spare timber board template choices, positions, rotations, and scales; visible/collision instances replay the same recipe |
| Roofs | Authored roof collision-node paths and local bounds, reused across footprint dimensions and rotations |
| Spiral stairs | Local tread layouts, reusable across elevations and rotations |
| Straight stairs | Local surfaces, tread data, and wall boxes, independent of world placement |

`scripts/object-cache/catalog.json` defines the finite variant catalog. `propSeeds` and
`woodStackSizes` enumerate additional wood-stack recipes; planter catalogue IDs use
`cache-planter-<seed>`. Saved castles retain their actual object IDs so ID-seeded
plants and wood stacks match gameplay. The CLI
also scans map JSON under `src/game/maps/` for explicit shelf, bowl, and staircase
definitions. It also expands saved castle recipes through the production planners
to include their generated shelves, bowls, straight stairs, planters, and wood stacks. Use `--maps
directory` to select another saved-map directory. New castle seeds and uncatalogued
dimensions continue to use normal generation.

Bowl catalog generation enumerates **every ordered combination** of
`bowlItemTypes` from zero through `bowlMaxItems` (default 3), plus combinations
explicitly present in saved maps. The built-in offline baker supports Apple,
Bread, GreenVegetable, Book, and nested Bowl item classes. Add complete definitions
to the catalog's `objects` array for custom supported combinations or shelves.
An unsupported offline item fails the command rather than silently baking an
incorrect substitute; that item still works through normal runtime generation.

Seeds, dimensions, and arbitrary nested item definitions are unbounded, so this
does not attempt to enumerate every theoretical object. Catalog coverage is
explicit and cache misses remain supported. Increasing the bowl bound grows
exponentially; the CLI accepts bounds from 0 to 6.

## Deployment and local development

GitHub Pages deployment runs the baker after `npm ci` and before `build:ssg`.
Each deployment therefore includes fresh cache chunks without committing cache
files. For a separate SPA deployment, run `npm run cache:objects` before
`npm run build:spa`.

A clean checkout works without generating anything: an empty cache glob falls
back to the generators. Baking needs Node 24+ and the repository's Ammo binary;
it uses PlayCanvas's actual GLB importer with a null graphics device and does not
require Blender, a display, or a GPU. It does not change models or previews.

Focused verification:

```sh
node --test test/unit/game/cache/*.test.js
```

## Room layouts

Room furnishing recipes use the same ObjectDataCache shards, source invalidation,
cloning, and fallback as other game data. Bake saved castle room variants with
`npm run cache:objects -- --object rooms` (also included in the default bake).
Keys include the generator class and configuration, full room definition, and all
context supplied by the caller (seed, openings, stairs, chimneys, occupied furniture).
Placement validation and repair still run after replaying a recipe.

Set `useCacheSettingsStore().roomLayoutCache` to `false` to bypass room recipe
lookups. It defaults to `true` and applies on the next map load or regeneration,
including workers and their local fallback. Other object caches stay enabled.
Uncatalogued room inputs generate normally.

## Compiled castle plans

Compiled castle plans use the same baked cache, including bounded JSON fragments
and source invalidation. The default bake includes them; use
`npm run cache:objects -- --object castles` for saved castle recipes only.
Keys include base plan ID, seed, position and dimensions, doors, and requested style.
Hits skip castle construction and return a private copy of the complete plan,
including geometry, furnishings, and terrace finishes. Abort checks still run.

Set `useCacheSettingsStore().castlePlanCache` to `false` to bypass full-plan
lookups on the next map load or regeneration, including workers and local fallback.
It defaults to `true`. Room caching remains independently configurable and is used
when a complete castle plan misses or full-plan caching is disabled. Disabling room
caching alone does not bypass an already compiled castle plan.

Cache toggles live in `src/stores/cache-settings-store.js`. The existing Pinia
persistence plugin saves both settings to localStorage under `cache-settings`
and restores them on subsequent visits.

## Compiled maps

Map-specific terrain instance matrices and island ownership groups live in
`map.compiledMap`, backed by the `compiled-maps` family in the same baked cache.
Object placements and terrain draw commands remain the canonical map records;
compiled data is derived from those records, map dimensions, river cells, and
island/bridge topology. Renderers reject stale data after edits and fall back to
normal matrix and ownership calculation. Material/mesh draw batching still uses
the current scene's resources. Entities, GPU buffers, collision bodies, treasure,
and other playthrough state are never shared through this cache.

The level worker prepares this data before scene assembly, with a local fallback.
Use `npm run cache:objects -- --object maps` to bake saved map variants (included
in the default bake). Unknown inputs compile normally. Reusable castle and prop
recipes remain separate from map-owned data.

`useCacheSettingsStore().compiledMapCache` defaults to `true` and persists to
localStorage alongside the room and castle toggles. Set it to `false` before the
next map load/regeneration to use the original runtime transform path.

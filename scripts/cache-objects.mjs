import { sources } from "./object-cache/asset-hooks.mjs";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, relative } from "node:path";
import { runInNewContext } from "node:vm";
import * as pc from "playcanvas";
import { OfflineModelLibrary } from "./object-cache/OfflineModelLibrary.mjs";
import { writeCache } from "./object-cache/write-cache.mjs";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run cache:objects -- [--object trees,bushes,books,bowls,roof,stairs,planters,wood-stacks] [--catalog file.json] [--maps directory]\nBakes all catalog variants plus saved-map definitions into type folders of SPA cache shards.\nBowl combinations are ordered; bowlMaxItems bounds their exhaustive enumeration (0..6).\nMissing/stale entries use runtime generators. Run again after changing sources or models.");
  process.exit(0);
}

/**
 * @param {string} flag @param {string} fallback
 */
function option(flag, fallback) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return fallback;
  }
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new TypeError(`Missing value for ${flag}`);
  }
  return args[index + 1];
}
for (let index = 0; index < args.length; index += 2) {
  if (!["--object", "--catalog", "--maps"].includes(args[index])) {
    throw new TypeError(`Unknown argument: ${args[index]}`);
  }
}
const selected = new Set(option("--object", "trees,bushes,books,bowls,roof,stairs,planters,wood-stacks").split(","));
for (const name of selected) {
  if (!["trees", "bushes", "books", "bowls", "roof", "stairs", "planters", "wood-stacks"].includes(name)) {
    throw new TypeError(`Unknown cache object: ${name}`);
  }
}
const catalogPath = resolve(option("--catalog", "scripts/object-cache/catalog.json"));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
if (!Number.isInteger(catalog.bowlMaxItems) || catalog.bowlMaxItems < 0 || catalog.bowlMaxItems > 6) {
  throw new RangeError("bowlMaxItems must be an integer from 0 through 6");
}

const { ObjectDataCache } = await import("../src/game/cache/ObjectDataCache.js");
const { mergeCollisionVoxels } = await import("../src/game/objects/shared/MergeCollisionVoxels.js");
const { BookMapObjects } = await import("../src/game/objects/castle-props/book/BookMapObjects.js");
const { SpiralStaircaseLayout } = await import("../src/game/objects/architecture/spiral-staircase/SpiralStaircaseLayout.js");
const stairs = await import("../src/game/objects/castle/stairs/CastleStraightStairs.js");
const { RoofCollisionLayout } = await import("../src/game/objects/castle/structure/RoofCollisionLayout.js");
const { Bowl } = await import("../src/game/objects/castle-props/bowl/Bowl.js");
const { Book } = await import("../src/game/objects/castle-props/book/Book.js");
const { Apple } = await import("../src/game/objects/castle-props/food/Apple.js");
const { Bread } = await import("../src/game/objects/castle-props/bread/Bread.js");
const { GreenVegetable } = await import("../src/game/objects/castle-props/food/GreenVegetable.js");
const { Planter } = await import("../src/game/objects/castle-props/planter/Planter.js");
const { FirewoodStack } = await import("../src/game/objects/castle-props/firewood-stack/FirewoodStack.js");
const { SpareTimberBundle } = await import("../src/game/objects/castle-props/spare-timber-bundle/SpareTimberBundle.js");
const itemClasses = new Map([Apple, Bread, GreenVegetable, Book, Bowl].map((Type) => [Type.name, Type]));
const definitions = [...(catalog.objects ?? [])];
const mapFiles = [];
/**
 * @param {string} path
 */
async function readMaps(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) {
      await readMaps(file);
    } else if (entry.name.endsWith(".json")) {
      const map = JSON.parse(await readFile(file, "utf8"));
      definitions.push(...(map.objects ?? []));
      mapFiles.push(relative(process.cwd(), file).replaceAll("\\", "/"));
    }
  }
}
await readMaps(resolve(option("--maps", "src/game/maps")));
ObjectDataCache.beginRecording();
if (selected.has("books") || selected.has("bowls") || (selected.has("stairs") || selected.has("planters") || selected.has("wood-stacks"))) {
  const { expandCastles } = await import("./object-cache/expand-castles.mjs");
  definitions.push(...await expandCastles(definitions));
  for (const file of await readdir("src/game/generator/castle/plans")) {
    if (file.endsWith(".json")) {
      sources.add(`src/game/generator/castle/plans/${file}`);
    }
  }
  sources.add("scripts/object-cache/expand-castles.mjs");
}

for (const [group, folder, names] of [
  ["trees", "trees", ["OakTree", "PineTree", "SaplingTree", "TallTree"]],
  ["bushes", "bushes", ["RoundBush", "WideBush"]],
]) {
  if (!selected.has(group)) {
    continue;
  }
  for (const name of names) {
    const Type = (await import(`../src/game/objects/vegetation/${folder}/${name}.js`))[name];
    const rows = [...new Set(Type.collisionRows.map((row) => row.y))].sort((a, b) => a - b);
    for (const minimum of rows) {
      const cells = Type.collisionRows.filter((row) => row.y >= minimum).flatMap(
        (row) => row.cells.map(([x, z]) => ({
          x,
          y: row.y,
          z,
        })));
      mergeCollisionVoxels(cells, group);
    }
  }
}
if (selected.has("books")) {
  for (const seed of catalog.bookSeeds) {
    for (const length of catalog.bookLengths) {
      for (const height of catalog.bookHeights) {
        definitions.push({
          object: "Shelf",
          id: `cache-books-${seed}`,
          seed,
          from: {
            x: 0,
            y: 0,
            z: 0,
          },
          to: {
            x: length,
            y: 0,
            z: 0,
          },
          height,
        });
      }
    }
  }
  for (const shelf of definitions) {
    if (shelf.object === "Shelf" && shelf.variant !== "storage" && !shelf.items) {
      BookMapObjects.forShelf(shelf);
    }
  }
}
if (selected.has("stairs")) {
  for (const rise of catalog.spiralRises) {
    for (const stepProfile of ["castle", "standard"]) {
      for (const rotation of [0, 90, 180, 270]) {
        definitions.push({
          object: "SpiralStaircase",
          Z1: 0,
          Z2: rise,
          rotation,
          stepProfile,
        });
      }
    }
  }
  for (const radius of catalog.straightRadii) {
    for (const rise of catalog.straightRises) {
      definitions.push({
        object: "StraightStaircase",
        radius,
        rise,
      });
    }
  }
  for (const definition of definitions) {
    if (definition.object === "SpiralStaircase") {
      SpiralStaircaseLayout.steps(definition);
    } else if (definition.object === "StraightStaircase") {
      const surfaces = stairs.castleStraightStairSurfaces(definition);
      for (const surface of surfaces) {
        stairs.castleStraightStairTreads(surface);
      }
      stairs.castleStraightStairWalls(definition);
    }
  }
}

if (selected.has("bowls") || selected.has("roof") || selected.has("planters") || selected.has("wood-stacks")) {
  // Same Ammo binary and Engine importer as the game; no display/GPU required.
  const base = new URL("../src/assets/game/wasm/ammo/", import.meta.url);
  const context = {
    module: { exports: {} },
    exports: {},
    require: createRequire(import.meta.url),
    process,
    __dirname: "",
    Buffer,
    console,
    setTimeout,
    clearTimeout,
  };
  runInNewContext(readFileSync(new URL("ammo.wasm.js", base), "utf8").replace("export default Ammo;", ""), context);
  globalThis.Ammo = await context.module.exports({ wasmBinary: readFileSync(new URL("ammo.wasm.wasm", base)) });
  sources.add("src/assets/game/wasm/ammo/ammo.wasm.js");
  sources.add("src/assets/game/wasm/ammo/ammo.wasm.wasm");
  const canvas = {
    width: 1,
    height: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const app = new pc.Application(canvas, { graphicsDevice: new pc.NullGraphicsDevice(canvas) });
  const library = new OfflineModelLibrary(app);
  try {
    const assemblyTypes = [Planter, FirewoodStack, SpareTimberBundle].filter((Type) => selected.has(Type === Planter ? "planters" : "wood-stacks"));
    for (const Type of assemblyTypes) {
      await library.load([Type.modelUrl]);
      const variants = [...definitions.filter((definition) => definition.object === Type.name)];
      for (const seed of catalog.propSeeds ?? []) {
        if (Type === Planter) {
          variants.push({
            object: Type.name,
            id: `cache-planter-${seed}`,
          });
        } else {
          for (const size of catalog.woodStackSizes?.[Type.name] ?? []) {
            variants.push({
              object: Type.name,
              id: `cache-wood-${seed}`,
              firewoodSeed: seed,
              timberSeed: seed,
              ...size,
            });
          }
        }
      }
      for (const definition of variants) {
        const model = library.instantiate(Type.modelUrl);
        try {
          Type.prototype.prepareModel.call({ definition }, model, false);
        } finally {
          model.destroy();
        }
      }
    }
    if (selected.has("roof")) {
      const roofPath = resolve("src/game/models/castle/residential/blue-roof.glb");
      await library.load([roofPath]);
      const roof = library.instantiate(roofPath);
      RoofCollisionLayout.read(roof);
      roof.destroy();
    }
    if (selected.has("bowls")) {
      await library.load([Bowl.modelUrl, ...Book.modelUrls, Apple.modelUrl, Bread.modelUrl, GreenVegetable.modelUrl]);
      /**
       * @param {string[]} types
       */
      const combinations = (types) => {
        definitions.push({
          object: "Bowl",
          items: types.map((object) => ({ object })),
        });
        if (types.length < catalog.bowlMaxItems) {
          for (const type of catalog.bowlItemTypes) {
            combinations([...types, type]);
          }
        }
      };
      combinations([]);
      const seen = new Set();
      /**
       * @param {import("../src/game/objects/ObjectTypes.js").MapObjectDefinition} definition
       */
      const createObject = (definition) => {
        const Type = itemClasses.get(definition.object);
        if (!Type) {
          throw new TypeError(`Unsupported bowl item in offline catalog: ${definition.object}`);
        }
        return new Type({
          pc,
          app,
          modelLibrary: library,
          definition,
          runtime: { createObject },
        });
      };
      const bowls = definitions.filter((definition) => definition.object === "Bowl");
      for (const [index, definition] of bowls.entries()) {
        const key = ObjectDataCache.key({
          items: definition.items ?? [],
          scale: definition.scale,
          stretch: definition.stretch,
        });
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        console.log(`Packing bowl ${index + 1}/${bowls.length} (${definition.items?.length ?? 0} items)`);
        const bowl = createObject({
          ...definition,
          id: "cache-bowl",
          position: {
            x: 0,
            y: 0,
            z: 0,
          },
        });
        try {
          app.root.addChild(bowl.entity);
          bowl.onSceneReady();
        } finally {
          bowl.destroy();
        }
      }
    }
  } finally {
    library.destroy();
    app.destroy();
  }
}

const cache = ObjectDataCache.finishRecording();
// Record build inputs, including transitive runtime imports and loaded GLBs.
for (const file of ["scripts/cache-objects.mjs", "scripts/object-cache/asset-hooks.mjs",
  "scripts/object-cache/write-cache.mjs", "scripts/object-cache/OfflineModelLibrary.mjs", "scripts/object-cache/source-stamp.cjs", "scripts/object-cache/vite-plugin.cjs", "package-lock.json"]) {
  sources.add(file);
}
const localCatalog = relative(process.cwd(), catalogPath).replaceAll("\\", "/");
if (!localCatalog.startsWith("../")) {
  sources.add(localCatalog);
}
await writeCache(cache, sources, mapFiles);

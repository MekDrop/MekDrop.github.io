import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import * as pc from "playcanvas";
import { generateMap } from "../../../../src/game/generator/map/MapGenerator.js";

const root = new URL("../../../../", import.meta.url);
const hooks = registerHooks({
  load: (url, context, nextLoad) => {
    const loaded = nextLoad(url, context);
    if (url.endsWith("/MapObjectFactory.js")) {
      const directory = new URL("./enemies/", url);
      const entries = readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .filter(entry => readdirSync(new URL(`${entry.name}/`, directory)).includes("index.js"))
        .map(entry => {
          const specifier = `./enemies/${entry.name}/index.js`;

          return `${JSON.stringify(specifier)}: await import(${JSON.stringify(specifier)})`;
        });

      return {
        ...loaded,
        source: loaded.source.toString()
          .replace('import.meta.glob("./enemies/*/index.js", { eager: true })', `{${entries.join(",")}}`)
          .replace('import.meta.globEager("./enemies/*/index.js")', `{${entries.join(",")}}`),
      };
    }
    if (url.endsWith("/RugModels.js")) {
      const directory = new URL("../../../models/rug/", url);
      const modules = readdirSync(directory).filter(name => name.endsWith(".js"));
      const entries = modules.map(name => {
        const specifier = `../../../models/rug/${name}`;

        return `${JSON.stringify(specifier)}: await import(${JSON.stringify(specifier)})`;
      });

      return {
        ...loaded,
        source: loaded.source.toString().replace('import.meta.globEager("../../../models/rug/*.js")', `{${entries.join(",")}}`),
      };
    }
    return loaded;
  },
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith("src/")) {
      specifier = new URL(specifier, root).href;
    }
    if (specifier.includes("?url") || /\.(png|jpg|webp|svg)$/.test(specifier)) {
      return {
        url: `data:text/javascript,export default ${encodeURIComponent(JSON.stringify(specifier))}`,
        shortCircuit: true,
      };
    }
    if (specifier.includes("?raw")) {
      const source = readFileSync(new URL(specifier.split("?")[0], context.parentURL), "utf8");

      return {
        url: `data:text/javascript,export default ${encodeURIComponent(JSON.stringify(source))}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { MapObjectFactory } = await import("../../../../src/game/objects/MapObjectFactory.js");
hooks.deregister();

test("asset discovery excludes absent objects and deduplicates shared models", () => {
  assert.deepEqual(MapObjectFactory.assetsFor([]), {
    modelUrls: [],
    textureUrls: {},
  });
  const bell = {
    object: "SignalBell",
    id: "bell",
  };
  const assets = MapObjectFactory.assetsFor([bell, {
    ...bell,
    id: "bell-2",
  }]);
  assert.equal(assets.modelUrls.length, 2);
  assert.ok(assets.modelUrls.every(url => url.includes("bell")));
  assert.deepEqual(assets.textureUrls, {});
  const lantern = MapObjectFactory.assetsFor([{
    object: "Lantern",
    id: "lantern",
  }]);
  assert.match(lantern.textureUrls.castleFireParticle, /castle-fire-particle/);
  const castle = MapObjectFactory.assetsFor([{
    object: "Castle",
    id: "castle",
  }]);
  assert.match(castle.textureUrls.castleDoor, /timber-grain/);
  assert.match(castle.textureUrls.castleStone, /castle-stone/);
  const bowl = MapObjectFactory.assetsFor([{
    object: "Bowl",
    id: "bowl",
    items: [{
      object: "GreenVegetable",
      id: "vegetable",
    }],
  }]);
  assert.ok(bowl.modelUrls.some(url => url.includes("green-vegetable")));
});

test("audio dependencies include only present objects and deduplicate repeated bells", () => {
  assert.deepEqual(MapObjectFactory.audioUrlsFor([{
    id: "chair",
    object: "Chair",
  }]), []);
  const urls = MapObjectFactory.audioUrlsFor([
    {
      id: "bell-1",
      object: "SignalBell",
    },
    {
      id: "bell-2",
      object: "SignalBell",
    },
    {
      id: "chair",
      object: "Chair",
    },
  ]);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /signal-bell\.wav/);
});

test("castle-generated lanterns publish canonical names and explicit model types", async () => {
  const map = await generateMap({ mapName: "mv7wfhrn_1d30anq" });
  MapObjectFactory.prepareMap(map);
  assert.ok(map.objects.some(item => item.object === "Lantern"));
  const lanterns = map.objects.filter(item => item.object === "Lantern");
  assert.ok(lanterns.every(item => ["entrance", "wall", "table"].includes(item.type)));
});

test("map objects retain one mutable shared runtime and one contained-object factory", () => {
  const canopy = { shared: true };
  const runtime = {
    canopy,
    resolveMaterial: value => value,
    instanceRenderer: { addCubeMatrix: () => {} },
  };
  const options = {
    pc,
    runtime,
    definition: {
      id: "earth-1",
      object: "Earth",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      geometry: {
        method: "addCubeMatrix",
        args: [],
      },
    },
  };
  const first = MapObjectFactory.create(options);
  const createObject = runtime.createObject;
  assert.equal(typeof createObject, "function", "factory publishes into the shared runtime, not a discarded copy");
  const second = MapObjectFactory.create({
    ...options,
    definition: {
      ...options.definition,
      id: "grass-1",
      object: "Grass",
    },
  });
  assert.equal(runtime.canopy, canopy, "grass reuses the existing map-wide canopy");
  assert.equal(runtime.createObject, createObject, "per-object setup must preserve runtime identity");
  first.destroy();
  second.destroy();
});

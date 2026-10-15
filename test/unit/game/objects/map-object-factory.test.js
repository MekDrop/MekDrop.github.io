import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as pc from "playcanvas";
import { generateMap } from "../../../../src/game/generator/map/MapGenerator.js";

const root = new URL("../../../../", import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("src/")) { specifier = new URL(specifier, root).href; }
    if (specifier.includes("?url") || /\.(png|jpg|webp|svg)$/.test(specifier)) {
      return { url: `data:text/javascript,export default ${encodeURIComponent(JSON.stringify(specifier))}`, shortCircuit: true };
    }
    if (specifier.includes("?raw")) {
      const source = readFileSync(new URL(specifier.split("?")[0], context.parentURL), "utf8");
      return { url: `data:text/javascript,export default ${encodeURIComponent(JSON.stringify(source))}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { MapObjectFactory } = await import("../../../../src/game/objects/MapObjectFactory.js");
hooks.deregister();

test("castle-generated lanterns are normalized after room objects are published", async () => {
  const map = await generateMap({ mapName: "mv7wfhrn_1d30anq" });
  MapObjectFactory.prepareMap(map);
  assert.ok(map.objects.some(item => item.object === "Lantern"));
  assert.ok(!map.objects.some(item => ["VestibuleLantern", "ServantBedsideLantern",
    "EntranceLantern", "WallLantern", "TableLantern"].includes(item.object)));
});

test("map objects retain one mutable shared runtime and one contained-object factory", () => {
  const canopy = { shared: true };
  const runtime = { canopy, resolveMaterial: value => value, instanceRenderer: { addCubeMatrix() {} } };
  const options = { pc, runtime, definition: { id: "earth-1", object: "Earth",
    position: { x: 0, y: 0, z: 0 }, geometry: { method: "addCubeMatrix", args: [] } } };
  const first = MapObjectFactory.create(options);
  const createObject = runtime.createObject;
  assert.equal(typeof createObject, "function", "factory publishes into the shared runtime, not a discarded copy");
  const second = MapObjectFactory.create({ ...options, definition: { ...options.definition,
    id: "grass-1", object: "Grass" } });
  assert.equal(runtime.canopy, canopy, "grass reuses the existing map-wide canopy");
  assert.equal(runtime.createObject, createObject, "per-object setup must preserve runtime identity");
  first.destroy();
  second.destroy();
});

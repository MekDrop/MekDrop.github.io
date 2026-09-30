import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import * as pc from "playcanvas";
import { SceneObjectRegistry } from "../../../../../src/game/rendering/scene/SceneObjectRegistry.js";
import { GRASS_SURFACE_LIFT } from "../../../../../src/game/config/terrain.js";
import { MAP_TILE_TYPE } from "../../../../../src/game/enum/MapTileType.js";

// Substitute GPU resources while exercising the actual classes and factory.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith("/terrain/Grass.js") && /Grass(Carpet|Surface)\.js$/.test(specifier)) {
      const name = specifier.includes("Carpet") ? "GrassCarpet" : "GrassSurface";
      return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(`
        export class ${name} {
          static get modelUrls() { return ["meadow.glb", "clover.glb"]; }
          constructor(options) { this.options = options; this.entity = { name: "canopy" }; this.material = {}; this.calls = []; }
          supportPointsWithin(position, radius) { return [position, radius]; }
          clearAt(...args) { this.calls.push(["clear", ...args]); }
          refreshObstacles(...args) { this.calls.push(["refresh", ...args]); }
          setIslandOffsets(...args) { this.calls.push(["offsets", ...args]); }
          destroy() { this.calls.push(["destroy"]); }
        }
      `)}` };
    }
    if (/\.(png|jpg|glb|frag|vert)(\?(url|raw))?$/.test(specifier)) {
      return { shortCircuit: true, url: `data:text/javascript,export default ${JSON.stringify(specifier)}` };
    }
    return nextResolve(specifier, context);
  },
});
const { Earth } = await import("../../../../../src/game/objects/terrain/Earth.js");
const { Grass } = await import("../../../../../src/game/objects/terrain/Grass.js");
const { MapObjectFactory } = await import("../../../../../src/game/objects/MapObjectFactory.js");
hooks.deregister();

function fixture() {
  const cubes = [];
  const children = [];
  const weightQueries = [];
  const objects = new SceneObjectRegistry();
  const contacts = [{ grassFootContacts: [{ x: 1 }] }, { grassImpressionContacts: [{ x: 2 }] }];
  const runtime = {
    mapData: { cols: 3, rows: 3, grid: Array.from({ length: 3 }, () => [1, 1, 1]), heightmap: Array.from({ length: 3 }, () => [2, 2, 2]), objects: [] },
    objects,
    camera: { zoom: 1.25 },
    root: { addChild: (child) => children.push(child) },
    sideVariantCount: 6,
    instanceRenderer: { addCubeMatrix: (...args) => cubes.push(args), addBoxMatrix: (...args) => cubes.push(args) },
    collisionWorld: { grassWeightAt: (...args) => { weightQueries.push(args); return 0.4; } },
    getContactProviders: () => contacts,
  };
  return { runtime, cubes, children, weightQueries, objects };
}

describe("terrain building objects", () => {
  it("constructs authored Grass and Earth through the normal object factory", () => {
    const { runtime, cubes, children, objects } = fixture();
    const definitions = [
      { id: "earth", object: "Earth", tile: { col: 1, row: 1 }, level: 0 },
      { id: "grass", object: "Grass", position: { x: 0, y: 1.5, z: 0 }, tile: { col: 1, row: 1 } },
      { id: "other-grass", object: "Grass", position: { x: 1, y: 1.5, z: 0 }, tile: { col: 2, row: 1 } },
    ];
    const result = MapObjectFactory.createAll({ pc, app: {}, definitions, runtime, onCreate: (object) => objects.add("mapObject", object) });
    assert.ok(result[0] instanceof Earth);
    assert.ok(result[1] instanceof Grass);
    assert.equal(result[1].definition, definitions[1]);
    assert.deepEqual(result[0].visualRoots, []);
    assert.deepEqual(result[1].visualRoots, []);
    assert.deepEqual(result[1].tile, { col: 1, row: 1 });
    assert.deepEqual([...result[0].entity.getLocalPosition().toArray()], [0, 0.5, 0]);
    assert.deepEqual(cubes[0], ["earth", "grassEarthSide-depth-1-0", 0, 0.5, 0, "full", "earth", 0]);
    assert.match(cubes[1][0], /^grass-[0-5]$/);
    assert.equal(cubes[1][1], "grassTopSide-depth-0-0");
    assert.equal(cubes[1][7], GRASS_SURFACE_LIFT);
    assert.equal(children.length, 1, "blocks share one canopy without per-block GPU resources");
    assert.ok(MapObjectFactory.modelUrls.includes("meadow.glb"));
    assert.ok(MapObjectFactory.textureUrls.grassSide);
    assert.ok(MapObjectFactory.textureUrls.earthSide);
    result.forEach((object) => object.destroy());
  });

  it("keeps grass contact, obstacle, excavation, zoom, motion, and disposal behavior in Grass", () => {
    const { runtime, objects, weightQueries } = fixture();
    Earth.prepareRuntime(runtime);
    const grass = new Grass({ pc, app: {}, definition: { id: "grass", object: "Grass", position: { x: 0, y: 1.5, z: 0 } }, runtime });
    const { carpet, surface } = runtime.canopy;
    assert.deepEqual(surface.options.getImpressionContacts(), [{ x: 1 }, { x: 2 }]);
    objects.add("mapObject", { grassSurfaceContacts: [{ radius: 0.5 }] });
    assert.deepEqual(surface.options.getSurfaceContacts(), [{ radius: 0.5 }]);
    assert.equal(surface.options.getWeightAt(1, 2, 3), 0.4);
    assert.deepEqual(weightQueries, [[1, 3, 2]]);
    const point = { x: 0, y: 2, z: 0 };
    assert.deepEqual(runtime.getGrassSupportPoints(point, 0.3), [point, 0.3]);
    grass.onSceneReady();
    grass.onObjectRemoved({ tile: { col: 1, row: 1 } });
    grass.onTerrainExcavated(point, 0.4);
    grass.setIslandOffsets(0.1, -0.2);
    runtime.camera.zoom = 2;
    grass.onCameraChanged();
    assert.equal(carpet.zoom, 2);
    assert.equal(surface.zoom, 2);
    assert.deepEqual(carpet.calls, [["clear", point, 0.4], ["offsets", 0.1, -0.2]]);
    assert.deepEqual(surface.calls, [["refresh"], ["refresh", { col: 1, row: 1 }]]);
    grass.destroy();
    assert.deepEqual(carpet.calls.at(-1), ["destroy"]);
    assert.deepEqual(surface.calls.at(-1), ["destroy"]);
    assert.equal(MapObjectFactory.surfaceLiftForTile(MAP_TILE_TYPE.GRASS), GRASS_SURFACE_LIFT);
    assert.equal(MapObjectFactory.surfaceLiftForTile(MAP_TILE_TYPE.PATH), 0);
  });
});

// Captured from the pre-refactor renderer, including every cube, ramp,
// riverbed, cap, deck, railing command, and per-block material choice.
describe("terrain rendering compatibility", () => {
  for (const [options, sha256] of [
    [{ mapName: "pipeline-baseline-rivers", numPaths: 3 }, "e880d99bc860f73321e7f29e39ddb7d0af5d3596cbd2dcaf117f68e605f10cec"],
    [{ mapName: "pipeline-baseline-overpass", numPaths: 4 }, "1eb57e317ed82148049720e4999fa9eec4bd61ea92e7e6348f95eff369094a24"],
    [{ mapName: "terrain-object-contract", numPaths: 2, numRivers: 0 }, "997c809e576648c91967df0b73b96e8cc7fad2dc27a9ad2e1c723e03d6593fa1"],
  ]) {
    it(`preserves geometry and materials for ${options.mapName}`, async () => {
      const mapData = await MapGenerator.generate(options);
      const runtime = { mapData, sideVariantCount: 6 };
      Earth.prepareRuntime(runtime);
      const commands = [
        ...mapData.objects.filter(({ generated }) => generated).map(({ geometry }) => geometry),
        ...mapData.renderCommands,
      ].map(({ method, args }) => JSON.stringify({ method, args: args.map(runtime.resolveMaterial) })).sort();
      assert.equal(createHash("sha256").update(JSON.stringify(commands)).digest("hex"), sha256);
    });
  }
});

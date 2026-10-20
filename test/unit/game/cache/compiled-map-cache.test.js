import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as pc from "playcanvas";
import { CompiledMapCache } from "../../../../src/game/cache/CompiledMapCache.js";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";
import { TerrainInstanceRenderer } from "../../../../src/game/rendering/terrain/TerrainInstanceRenderer.js";
import { GameMapLoader } from "../../../../src/game/GameMapLoader.js";

const original = ObjectDataCache.data;
afterEach(() => {
  ObjectDataCache.finishRecording();
  ObjectDataCache.data = original;
});

function fixture() {
  return {
    cols: 3,
    rows: 3,
    objects: [{
      geometry: {
        method: "addCubeMatrix",
        args: ["grass-0", "side", -1, 0.5, -1, "full", "earth", 0.04],
      },
    }],
    renderCommands: [{
      method: "addBoxMatrix",
      args: ["grass-0", "side", 1, 1.25, 1, 90, 1, 0.5, 2, "full", "earth", 25],
    }],
    islandConnectorData: {
      islands: [["0,0"], ["2,2"]],
      cells: [],
    },
  };
}

test("map recipes replay without transform computation, isolate copies, and reject edited inputs", () => {
  const map = fixture();
  ObjectDataCache.beginRecording();
  CompiledMapCache.prepare(map);
  const expected = structuredClone(map.compiledMap);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  const setTRS = pc.Mat4.prototype.setTRS;
  pc.Mat4.prototype.setTRS = () => assert.fail("transform computed on baked hit");
  try {
    CompiledMapCache.prepare(map);
  } finally {
    pc.Mat4.prototype.setTRS = setTRS;
  }
  assert.deepEqual(map.compiledMap, JSON.parse(JSON.stringify(expected)));
  map.compiledMap.islandCells[0].push("changed");
  CompiledMapCache.prepare(map);
  assert.deepEqual(map.compiledMap.islandCells[0], ["0,0"]);
  assert.equal(CompiledMapCache.matches(map), true);
  map.renderCommands[0].args[2] = 0;
  assert.equal(CompiledMapCache.matches(map), false);
  CompiledMapCache.prepare(map);
  assert.equal(CompiledMapCache.matches(map), true);
  map.islandConnectorData.islands.reverse();
  assert.equal(CompiledMapCache.matches(map), false);
  CompiledMapCache.prepare(map, false);
  assert.equal(Object.hasOwn(map, "compiledMap"), false);
});

test("cached and uncached rendering produce identical instance buffer bytes and island grouping", () => {
  const map = fixture();
  ObjectDataCache.beginRecording();
  CompiledMapCache.prepare(map);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  CompiledMapCache.prepare(map);
  const cached = capture(map);
  delete map.compiledMap;
  assert.deepEqual(cached, capture(map));
});

/**
 * @param {import("../../../../src/game/GameContracts.js").GameMapData} map
 */
function capture(map) {
  let nextMesh = 0;
  class Entity extends pc.Entity {
    addComponent(type, options) {
      this[type] = options;
    }
  }
  class VertexBuffer {
    constructor(device, format, count, options) {
      this.data = options.data;
    }
  }
  class MeshInstance {
    constructor(mesh, material) {
      this.mesh = mesh;
      this.material = material;
    }
    setInstancing(buffer) {
      this.buffer = buffer;
    }
  }
  const root = new Entity("terrain");
  const renderer = new TerrainInstanceRenderer({
    pc: {
      ...pc,
      Entity,
      VertexBuffer,
      MeshInstance,
      VertexFormat: { getDefaultInstancingFormat: () => ({}) },
      Mesh: {
        fromGeometry: () => ({
          id: nextMesh++,
          incRefCount: () => {},
        }),
      },
    },
    app: { graphicsDevice: {} },
    root,
    materials: new Map(["grass-0", "side", "earth"].map((name) => [name, name])),
    mapData: map,
  });
  for (const command of [map.objects[0].geometry, ...map.renderCommands]) {
    renderer[command.method](...command.args);
  }
  renderer.build();

  return root.children.map((island) => ({
    name: island.name,
    batches: island.children.flatMap((entity) => entity.render.meshInstances).map((instance) => ({
      material: instance.material,
      mesh: instance.mesh.id,
      bytes: Buffer.from(instance.buffer.data.buffer),
    })),
  }));
}

test("map loading keeps fresh gameplay state outside compiled data and honors disable", () => {
  const source = {
    cols: 2,
    rows: 2,
    grid: [[1, 1], [1, 1]],
    heightmap: [[2, 2], [2, 2]],
    tileMeta: [[{}, {}], [{}, {}]],
    objects: [],
  };
  ObjectDataCache.beginRecording();
  const first = GameMapLoader.load(source, () => 0.1);
  ObjectDataCache.data = ObjectDataCache.finishRecording();
  const second = GameMapLoader.load(source, () => 0.9);
  assert.deepEqual(first.compiledMap, second.compiledMap);
  assert.notDeepEqual(first.objects, second.objects);
  assert.equal(Object.hasOwn(GameMapLoader.load(source, () => 0.1, { compiledMapCache: false }), "compiledMap"), false);
  assert.equal(Object.hasOwn(source, "compiledMap"), false);
});

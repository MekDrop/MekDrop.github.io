import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { it } from "node:test";
import * as engine from "playcanvas";
import { GrassInstanceData } from "../../../../../src/game/objects/ground-cover/GrassInstanceData.js";
import { GRASS_SURFACE_LIFT } from "../../../../../src/game/config/terrain.js";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith("/GrassEdgeMesh.js")) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,export class GrassEdgeMesh {
          static create() { return {refCount:0, incRefCount(){this.refCount++;}, decRefCount(){this.refCount--;}, destroy(){}}; }
          static batch(pc, device, mesh, material, matrices) { return pc.makeBatch("fringe", matrices, {name:"fringe"}); }
        }`,
      };
    }
    if (/\.(glb|frag|vert)\?(url|raw)$/.test(specifier)) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { GrassCarpet } = await import("../../../../../src/game/objects/ground-cover/GrassCarpet.js");
hooks.deregister();

function fixture(deferDecoration) {
  const batches = [];
  const makeBatch = (_url, matrices, { name }) => {
    const entity = new engine.Entity(name);
    const data = new Float32Array(matrices);
    const parameters = new Map();
    entity.render = {
      meshInstances: [{
        parameters,
        setParameter: parameters.set.bind(parameters),
        setCustomAabb: () => {},
      }],
    };
    const batch = {
      entity,
      vertexBuffer: {
        lock: () => data,
        unlock: () => {},
        destroy: () => {},
      },
    };
    batches.push(batch);

    return batch;
  };
  const pc = {
    ...engine,
    makeBatch,
    Texture: class {
      data = new Uint8Array(32);
      lock() {
        return this.data;
      }
      unlock() {}
      destroy() {}
    },
    StandardMaterial: class {
      shaderChunks = { glsl: new Map() };
      setParameter() {}
      setAttribute() {}
      update() {}
      destroy() {}
    },
  };
  const carpet = new GrassCarpet({
    pc,
    device: {},
    mapData: {
      mapName: "deferred-carpet",
      cols: 4,
      rows: 2,
      grid: Array.from({ length: 2 }, () => Array(4).fill(1)),
      heightmap: Array.from({ length: 2 }, () => Array(4).fill(2)),
      tileMeta: Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => ({
        terrainCutouts: [],
      }))),
    },
    modelLibrary: {
      instantiateMergedBatch: makeBatch,
    },
    tileColors: [[1, 1, 1]],
    variantForTile: () => 0,
    zoom: 1,
    deferDecoration,
  });

  return {
    carpet,
    batches,
  };
}

it("defers grass batches, preserves early support queries, and remembers early excavation and zoom", () => {
  const jobs = [];
  const deferred = fixture((job) => jobs.push(job));
  assert.equal(jobs.length, 1);
  assert.equal(deferred.batches.length, 0);
  const work = jobs[0]();
  assert.equal(work.next().done, false);
  assert.equal(deferred.batches.length, 0, "placement generation itself yields");
  const position = {
    x: 0,
    y: 2 + GRASS_SURFACE_LIFT - 0.002,
    z: 0,
  };
  assert.ok(deferred.carpet.supportPointsWithin(position, 0.5).length > 0);
  deferred.carpet.clearAt(position, 0.5);
  deferred.carpet.zoom = 3;
  for (const step of work) {
    void step;
  }
  assert.ok(deferred.batches.length > 0);
  assert.ok(deferred.batches.every(({ entity }) =>
    entity.render.meshInstances[0].parameters.get("uGrassLodReveal") === 1), "late detail batches use the current zoom");
  let hidden = 0;
  for (const { vertexBuffer } of deferred.batches) {
    const data = vertexBuffer.lock();
    for (let index = 13; index < data.length; index += GrassInstanceData.stride) {
      hidden += Number(data[index] === -10000);
    }
  }
  assert.ok(hidden > 0, "late batches retain holes dug before decoration was ready");
  const immediate = fixture();
  immediate.carpet.clearAt(position, 0.5);
  immediate.carpet.zoom = 3;
  assert.deepEqual(
    deferred.batches.map(({ vertexBuffer }) => [...vertexBuffer.lock()]),
    immediate.batches.map(({ vertexBuffer }) => [...vertexBuffer.lock()]),
    "every final instance transform matches synchronous construction",
  );
  immediate.carpet.destroy();
  deferred.carpet.destroy();
});

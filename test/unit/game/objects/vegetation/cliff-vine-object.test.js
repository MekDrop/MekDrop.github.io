import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".glb?url")) {
      return { shortCircuit: true, url: `data:text/javascript,export default ${JSON.stringify(specifier)}` };
    }
    return nextResolve(specifier, context);
  },
});
const { CliffVine } = await import("../../../../../src/game/objects/vegetation/CliffVine.js");
hooks.deregister();

describe("cliff vine map objects", () => {
  it("creates one idempotent patch attached to its terrain tile", () => {
    const map = { rows: 3, cols: 3, mapName: "ivy", heightmap: [[0, 0, 0], [0, 3, 0], [0, 0, 0]],
      cliffVineData: [{ row: 1, col: 1, direction: "SOUTH", topY: 2.9, bottomY: 2.4, offset: 0.1, width: 0.16 }] };
    CliffVine.prepareMap(map);
    CliffVine.prepareMap(map);
    assert.equal(map.objects.length, 1);
    assert.equal(map.objects[0].object, "CliffVine");
    assert.equal(map.objects[0].position.y, 3);
    assert.ok(map.objects[0].height >= 1.05 && map.objects[0].height <= 2.25);
    assert.deepEqual(map.objects[0].tile, { col: 1, row: 1 });
  });
  it("moves all modular growth with its owning island", () => {
    const map = { islandConnectorData: { nearIsland: ["1,1"], farIsland: ["2,2"] } };
    const uploads = [];
    const modelLibrary = {
      instantiateMergedBatch(url, matrices) {
        const buffer = { setData(values) { uploads.push([...values]); }, destroy() {} };
        uploads.push([...matrices]);
        return { entity: new pc.Entity(url), vertexBuffer: buffer };
      },
    };
    const definition = { id: "ivy", tile: { col: 1, row: 1 }, position: { x: 0, y: 3, z: 0.515 }, rotation: 0, height: 0.6, seed: "ivy" };
    const patch = new CliffVine({ pc, modelLibrary, definition, runtime: { mapData: map } });
    const baseline = uploads.slice();
    patch.setIslandOffsets(0.5, -1);
    for (let batch = 0; batch < baseline.length; batch++) {
      const moved = uploads[batch + baseline.length];
      for (let index = 13; index < moved.length; index += 16) assert.ok(Math.abs(moved[index] - baseline[batch][index] - 0.5) < 1e-6);
    }
    patch.destroy();
  });
});

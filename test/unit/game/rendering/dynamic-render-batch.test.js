import assert from "node:assert/strict";
import { it } from "node:test";
import { DynamicRenderBatch } from "../../../../src/game/rendering/DynamicRenderBatch.js";

it("batches rigid parts while excluding hidden renderers and independently updated meshes", () => {
  const rigid = { enabled: true, meshInstances: [{ mesh: { vertexBuffer: { usage: 0 } } }] };
  const disabled = { enabled: false, meshInstances: rigid.meshInstances };
  const animated = { enabled: true, meshInstances: [{ skinInstance: {}, mesh: { vertexBuffer: { usage: 0 } } }] };
  const cloth = { enabled: true, meshInstances: [{ mesh: { vertexBuffer: { usage: 1 } } }] };
  const instanced = { enabled: true, meshInstances: [{ instancingData: {}, mesh: { vertexBuffer: { usage: 0 } } }] };
  const calls = [];
  const app = { batcher: {
    addGroup(name, dynamic, size) {
      assert.equal(name, "Vegetation");
      assert.equal(dynamic, true);
      assert.equal(size, 16);
      return { id: 7 };
    },
    generate(ids) { calls.push(ids); },
    removeGroup(id) { calls.push(id); },
  } };
  const batch = new DynamicRenderBatch(app, {
    name: "Vegetation",
    findComponents: () => [rigid, disabled, animated, cloth, instanced],
  }, 0);
  assert.equal(rigid.batchGroupId, 7);
  for (const render of [disabled, animated, cloth, instanced]) {
    assert.equal(render.batchGroupId, undefined);
  }
  batch.destroy();
  batch.destroy();
  assert.deepEqual(calls, [[7], 7]);
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { DynamicRenderBatch } from "../../../../src/game/rendering/DynamicRenderBatch.js";

/**
 * @returns {{app: {batcher: {addGroup: Function, markGroupDirty: Function, removeGroup: Function}}, added: number[], removed: number[]}}
 */
function fixture() {
  const added = [], removed = [];
  const app = {
    batcher: {
      addGroup() { const id = added.length; added.push(id);

        return { id }; },
      markGroupDirty() {},
      removeGroup(id) { removed.push(id); },
    },
  };

  return {
    app,
    added,
    removed,
  };
}

/**
 * @param {Partial<import("playcanvas").MeshInstance>} overrides
 * @returns {{enabled: boolean, batchGroupId: number, meshInstances: Partial<import("playcanvas").MeshInstance>[]}}
 */
function render(overrides = {}) {
  return {
    enabled: true,
    batchGroupId: -1,
    meshInstances: [
      {
        mesh: { vertexBuffer: { usage: 0 } },
        ...overrides,
      },
    ],
  };
}

it("shares compatible groups and retains surviving objects when a member is removed", () => {
  const { app, added, removed } = fixture();
  const first = render(), second = render();
  const a = new DynamicRenderBatch(app, { findComponents: () => [first] }, 0);
  const b = new DynamicRenderBatch(app, { findComponents: () => [second] }, 0);
  assert.equal(added.length, 1);
  assert.equal(first.batchGroupId, second.batchGroupId);
  a.destroy();
  assert.equal(first.batchGroupId, -1);
  assert.equal(second.batchGroupId, 0);
  assert.equal(removed.length, 0);
  b.destroy();
  b.destroy();
  assert.deepEqual(removed, [0]);
  const c = new DynamicRenderBatch(app, { findComponents: () => [render()] }, 0);
  assert.equal(added.length, 2);
  c.destroy();
});

it("leaves deformation buffers and existing foreign batches with their owners", () => {
  const { app } = fixture();
  const items = [render({ skinInstance: {} }), render({ morphInstance: {} }),
    render({ instancingData: {} }), render({ mesh: { vertexBuffer: { usage: 1 } } })];
  const foreign = render(); foreign.batchGroupId = 42;
  items.push(foreign);
  const batch = new DynamicRenderBatch(app, { findComponents: () => items }, 0);
  assert.deepEqual(items.map((item) => item.batchGroupId), [-1, -1, -1, -1, 42]);
  batch.destroy();
  assert.equal(foreign.batchGroupId, 42);
});

it("keeps stationary and moving batches separate through independent destruction", () => {
  const { app, added, removed } = fixture();
  const modes = [];
  app.batcher.addGroup = (_name, dynamic) => {
    modes.push(dynamic);
    const id = added.length;
    added.push(id);

    return { id };
  };
  const moving = render(), stationary = render(), secondStationary = render();
  const a = new DynamicRenderBatch(app, { findComponents: () => [moving] }, 0);
  const b = new DynamicRenderBatch(app, { findComponents: () => [stationary] }, 0, false);
  const c = new DynamicRenderBatch(app, { findComponents: () => [secondStationary] }, 0, false);
  assert.deepEqual(modes, [true, false]);
  assert.equal(stationary.batchGroupId, secondStationary.batchGroupId);
  assert.notEqual(stationary.batchGroupId, moving.batchGroupId);
  b.destroy();
  assert.deepEqual(removed, []);
  a.destroy();
  assert.deepEqual(removed, [0]);
  c.destroy();
  assert.deepEqual(removed, [0, 1]);
});

it("keeps actor batches separate from props while sharing compatible actors", () => {
  const { app, added, removed } = fixture();
  const prop = render(), actor = render(), secondActor = render();
  const a = new DynamicRenderBatch(app, { findComponents: () => [prop] }, 0);
  const b = new DynamicRenderBatch(app, { findComponents: () => [actor] }, 0, true, "characters");
  const c = new DynamicRenderBatch(app, { findComponents: () => [secondActor] }, 0, true, "characters");
  assert.equal(added.length, 2);
  assert.notEqual(prop.batchGroupId, actor.batchGroupId);
  assert.equal(actor.batchGroupId, secondActor.batchGroupId);
  b.destroy();
  assert.deepEqual(removed, []);
  a.destroy();
  assert.deepEqual(removed, [0]);
  c.destroy();
  assert.deepEqual(removed, [0, 1]);
});

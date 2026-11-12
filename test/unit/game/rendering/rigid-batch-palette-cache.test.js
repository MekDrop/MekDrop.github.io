import assert from "node:assert/strict";
import { it } from "node:test";
import { GraphNode } from "playcanvas";
import { cacheRigidBatchPalette } from "../../../../src/game/rendering/RigidBatchPaletteCache.js";

it("reuses unchanged GPU palettes and refreshes after ancestor or member motion", () => {
  const root = new GraphNode("batch");
  const parent = new GraphNode("island");
  const bone = new GraphNode("prop");
  parent.addChild(bone);
  let uploads = 0;
  const skin = {
    bones: [bone],
    updateMatrixPalette: () => {
      uploads++;
    },
  };
  const batch = {
    dynamic: true,
    meshInstance: { skinInstance: skin },
  };
  cacheRigidBatchPalette(batch);
  cacheRigidBatchPalette(batch);
  for (let frame = 0; frame < 120; frame++) {
    skin.updateMatrixPalette(root, frame);
  }
  assert.equal(uploads, 1);
  bone.setLocalPosition(0, 0, 0);
  skin.updateMatrixPalette(root, 120);
  assert.equal(uploads, 1, "redundant transform writes do not upload a new palette");
  bone.setLocalPosition(1, 0, 0);
  skin.updateMatrixPalette(root, 121);
  assert.equal(uploads, 2);
  parent.setLocalEulerAngles(0, 90, 0);
  skin.updateMatrixPalette(root, 122);
  assert.equal(uploads, 3);
  root.setLocalScale(2, 2, 2);
  skin.updateMatrixPalette(root, 123);
  assert.equal(uploads, 4);
  const another = new GraphNode("new member");
  skin.bones.push(another);
  skin.updateMatrixPalette(root, 124);
  assert.equal(uploads, 5);
});

it("leaves static batches alone", () => {
  const update = () => {};
  const skin = {
    bones: [],
    updateMatrixPalette: update,
  };
  cacheRigidBatchPalette({
    dynamic: false,
    meshInstance: { skinInstance: skin },
  });
  assert.equal(skin.updateMatrixPalette, update);
});

it("keeps moving batches current, then returns to stationary caching", () => {
  const node = new GraphNode("moving prop");
  let actual = null;
  let updates = 0;
  const refresh = () => {
    actual = node.getWorldTransform().data[12]; updates++;
  };
  const batch = {
    dynamic: true,
    meshInstance: {
      skinInstance: {
        bones: [node],
        updateMatrixPalette: refresh,
      },
    },
  };
  cacheRigidBatchPalette(batch);
  const update = () => batch.meshInstance.skinInstance.updateMatrixPalette(node, 0);
  for (let frame = 0; frame < 100; frame++) {
    node.setLocalPosition(frame % 7, 0, 0);
    update();
    assert.equal(actual, frame % 7);
  }
  for (let frame = 0; frame < 100; frame++) {
    update();
  }
  const settled = updates;
  for (let frame = 0; frame < 60; frame++) {
    update();
  }
  assert.equal(updates, settled);
  node.setLocalPosition(17, 0, 0);
  update();
  assert.equal(actual, 17);
});

it("does not reread stable bone matrices but notices ancestor changes", () => {
  const root = new GraphNode("batch");
  const parent = new GraphNode("parent");
  const bone = new GraphNode("bone");
  parent.addChild(bone);
  let reads = 0;
  const getWorldTransform = bone.getWorldTransform.bind(bone);
  bone.getWorldTransform = () => {
    reads++;

    return getWorldTransform();
  };
  const skin = {
    bones: [bone],
    updateMatrixPalette: () => {},
  };
  cacheRigidBatchPalette({
    dynamic: true,
    meshInstance: { skinInstance: skin },
  });
  skin.updateMatrixPalette(root, 0);
  const initial = reads;
  for (let i = 0; i < 100; i++) {
    skin.updateMatrixPalette(root, i);
  }
  assert.equal(reads, initial);
  parent.setLocalPosition(1, 0, 0);
  skin.updateMatrixPalette(root, 101);
  assert.ok(reads > initial);
});

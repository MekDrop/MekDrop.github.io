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

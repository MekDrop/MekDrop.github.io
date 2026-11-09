import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { Tree } from "../../../../../src/game/objects/vegetation/Tree.js";
import { VegetationInteraction } from "../../../../../src/game/objects/vegetation/VegetationInteraction.js";

function createTree(rotation = 0) {
  return new Tree({
    modelLibrary: { instantiate: () => new Entity("tree model") },
    modelUrl: "tree.glb",
    id: "tree",
    variant: "oak",
    collisionRows: [
      {
        y: 0,
        cells: [[0, 0]],
      },
      {
        y: 1,
        cells: [[0, 0]],
      },
      {
        y: 2,
        cells: [[0, 0]],
      },
      {
        y: 3,
        cells: [[0, 0], [1, 0], [-1, 0]],
      },
      {
        y: 4,
        cells: [[0, 0]],
      },
    ],
    x: 2,
    y: 3,
    z: 4,
    rotation,
  });
}

function strike(tree, height = tree.describe().cutHeight) {
  const transform = tree.entity.getWorldTransform();
  const previous = [new Vec3(-0.3, height, 0)].map(point => transform.transformPoint(point));
  const current = [new Vec3(0.3, height, 0)].map(point => transform.transformPoint(point));

  return tree.cutSweep(previous, current, height);
}

describe("tree trunk cutting", () => {
  it("targets the middle trunk, keeps the crown for two hits, and fells on the third", () => {
    for (const rotation of [0, 45, 90, 135]) {
      const tree = createTree(rotation);
      const original = tree.remainingVoxels.length;
      for (let hit = 1; hit <= 3; hit++) {
        tree.cuttingTargetFrom({
          x: 2,
          z: 6,
        });
        assert.equal(tree.describe().cutHeight, 0.375);
        const result = strike(tree);
        assert.equal(result.destroyed, false);
        assert.equal(strike(tree), null, "follow-through cannot count as another hit");
        if (hit < 3) {
          assert.equal(result.health, 3 - hit);
          assert.equal(tree.remainingVoxels.length, original);
        } else {
          assert.equal(result.felled, true);
          assert.deepEqual(tree.remainingVoxels, [{
            x: 0,
            y: 0,
            z: 0,
          }]);
        }
      }
      tree.cuttingTargetFrom({
        x: 2,
        z: 6,
      });
      assert.equal(tree.describe().verticalCut, true);
      assert.equal(tree.describe().cutHeight, 0.125);
      assert.equal(tree.cutVertical().destroyed, true);
      assert.equal(tree.canInteract, false);
      assert.equal(tree.cutVertical(), null);
    }
  });

  it("ignores a blade above the trunk and does not allow vertical strikes before felling", () => {
    const tree = createTree();
    tree.cuttingTargetFrom({
      x: 2,
      z: 6,
    });
    assert.equal(strike(tree, 1.125), null);
    assert.equal(tree.cutVertical(), null);
    assert.equal(tree.describe().health, 3);
  });

  it("stops after felling and removes the stump with one overhead impact", () => {
    const tree = createTree();
    let callbacks;
    let destroyed = 0;
    const hero = {
      position: new Vec3(2, 3, 6),
      isUsingTool: false,
      useTool: (tool, options) => {
        callbacks = options;

        return true;
      },
      repositionTool: () => true,
    };
    const interaction = new VegetationInteraction({
      item: tree,
      hero,
      tool: {},
      onDestroyed: () => destroyed++,
    });
    assert.equal(interaction.interact(), true);
    const action = { toolContext: callbacks.context };
    const transform = tree.entity.getWorldTransform();
    const previous = [transform.transformPoint(new Vec3(-0.3, 0.375, 0))];
    const current = [transform.transformPoint(new Vec3(0.3, 0.375, 0))];
    for (let hit = 0; hit < 3; hit++) {
      callbacks.onContact(action, previous, current);
      assert.equal(action.hitStopRemaining, 0.05);
      action.hitStopRemaining = 0.02;
      callbacks.onContact(action, previous, current);
      assert.equal(action.hitStopRemaining, 0.02, "follow-through must not extend the pause");
      if (hit < 2) {
        action.chopHitStopped = false;
        callbacks.onCycle(action);
      }
    }
    assert.equal(action.stopAfterCycle, true);
    assert.equal(destroyed, 0);
    interaction.interact();
    const vertical = { toolContext: callbacks.context };
    assert.equal(vertical.toolContext.verticalCut, true);
    assert.equal(callbacks.onImpact(vertical), true);
    assert.equal(destroyed, 1);
    callbacks.onImpact(vertical);
    assert.equal(destroyed, 1);
  });
});

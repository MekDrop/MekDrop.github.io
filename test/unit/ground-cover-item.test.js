import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GroundCoverItem } from "../../src/game/objects/ground-cover/GroundCoverItem.js";

function createSubject(ambientMotion) {
  class Entity {
    enabled = true;
    angles = [0, 0, 0];

    setLocalPosition() {}

    setLocalEulerAngles(...angles) {
      this.angles = angles;
    }

    setLocalScale() {}

    addChild() {}
  }

  const item = new GroundCoverItem({
    pc: { Entity },
    modelLibrary: { instantiateMerged: () => new Entity() },
    modelUrl: "ground-cover.glb",
    variant: "test-ground-cover",
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    scale: 1,
    flexibility: 0.4,
    stepReaction: "none",
    phase: 1.3,
    ambientMotion,
  });
  return item;
}

describe("ground cover item ambient motion", () => {
  it("keeps mushrooms still at fitted zoom strength", () => {
    const item = createSubject(0);

    for (let frame = 0; frame < 600; frame += 1) {
      item.advance(1 / 60);
      assert.deepEqual(item.entity.angles, [0, 0, 0]);
    }
  });

  it("retains mushroom sway at closer zoom strength", () => {
    const item = createSubject(1);

    item.advance(1 / 60);

    assert.notDeepEqual(item.entity.angles, [0, 0, 0]);
  });

  it("removes ambient tilt immediately when motion is disabled", () => {
    const item = createSubject(1);
    item.advance(1 / 60);

    item.ambientMotion = 0;

    assert.deepEqual(item.entity.angles, [0, 0, 0]);
  });
});

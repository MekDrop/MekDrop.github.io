import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DestructibleVegetation } from "../../src/game/objects/vegetation/DestructibleVegetation.js";

function createEntity() {
  return {
    name: "Vegetation",
    children: [],
    setLocalPosition() {},
    setLocalEulerAngles() {},
    destroy() {},
  };
}

describe("destructible vegetation grass footprint", () => {
  it("weights only ground-contact voxels instead of their bounding rectangle", () => {
    const vegetation = new DestructibleVegetation({
      modelLibrary: { instantiate: () => createEntity() },
      modelUrl: "vegetation.glb",
      id: "test",
      variant: "test",
      kind: "bush",
      cutsRequired: 2,
      collisionRows: [
        { y: 0, cells: [[-1, 0], [1, 0]] },
        { y: 1, cells: [[0, 0]] },
      ],
      x: 2,
      y: 3,
      z: 4,
    });

    assert.equal(vegetation.grassWeightAt(1.75, 4, 3.002), 1);
    assert.equal(vegetation.grassWeightAt(2.25, 4, 3.002), 1);
    assert.equal(vegetation.grassWeightAt(2, 4, 3.002), 0);
    assert.equal(vegetation.grassWeightAt(1.75, 4, 4), 0);
  });
});

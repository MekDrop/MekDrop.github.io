import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GroundCoverCollectible } from "../../src/game/objects/ground-cover/GroundCoverCollectible.js";

function createSubject() {
  const events = [];
  const collectible = new GroundCoverCollectible({
    id: "mushroom",
    variant: "red-mushroom",
    category: "mushroom",
    labelKey: "mushroom",
    icon: "mushroom",
    modelUrl: "mushroom.glb",
    position: { x: 0, y: 0, z: 0 },
    onCollect: () => {
      events.push("collect");
      return true;
    },
    onHide: () => events.push("hide"),
    onDestroy: (impact) => events.push({ impact }),
  });
  return { collectible, events };
}

describe("ground cover collectible destruction", () => {
  it("removes a destroyed mushroom without collecting or hiding its debris", () => {
    const { collectible, events } = createSubject();
    const impact = { directionX: 1, directionZ: 0 };

    collectible.destroy(impact);

    assert.equal(collectible.canInteract, false);
    assert.deepEqual(events, [{ impact }]);
    assert.equal(collectible.collect(), false);
  });
});

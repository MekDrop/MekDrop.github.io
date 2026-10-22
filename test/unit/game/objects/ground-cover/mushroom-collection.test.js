import { inventoryMushroomPart } from "../../../../../src/game/objects/ground-cover/MushroomParts.js";
import assert from "node:assert/strict";
import { it } from "node:test";
import { GroundCoverCollectible } from "../../../../../src/game/objects/ground-cover/GroundCoverCollectible.js";
import { GroundCoverInteraction } from "../../../../../src/game/objects/ground-cover/GroundCoverInteraction.js";
import { HeroCollectingActionState } from "../../../../../src/game/objects/characters/hero/states/action/HeroCollectionActionState.js";

/**
 * Exercise the real interaction, collectible and action state together.
 * @param {number} capacity
 * @param {boolean} accept
 */
function runCluster(capacity = 12, accept = true) {
  const items = [];
  const hidden = [];
  const mounted = [];
  const targets = [];
  let restarts = 0;
  let finished = 0;
  const state = new HeroCollectingActionState();
  const collectible = new GroundCoverCollectible({
    id: "cluster",
    variant: "forest-mushroom-cluster",
    category: "mushroom",
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    pickupPosition: (index) => ({
      x: index * 0.2,
      y: 0,
      z: 0.58,
    }),
    onCollect: (item) => {
      if (!accept || items.length >= capacity) {
        return false;
      }
      items.push(item);

      return true;
    },
    onHide: (index, complete) => hidden.push([index, complete]),
    createHeldItem: (index) => ({
      index,
      follow: () => {},
      destroy: () => {},
    }),
  });
  const hero = {
    get inventoryFull() {
      return items.length >= capacity;
    },
    collectGroundCover: (_category, action) => {
      targets.push(action.targetPosition.x);
      state.payload = {
        retarget: () => targets.push(action.nextTargetPosition().x),
        ...action,
        elapsed: 0,
        impactTime: 0.5,
        duration: 1,
        heldItemHideTime: 0.8,
      };

      return true;
    },
  };
  const interaction = new GroundCoverInteraction({
    collectible,
    hero,
  });
  assert.equal(interaction.interact(), true);
  const owner = {
    deltaTime: 0.25,
    feedback: {
      collection: {
        begin: () => restarts++,
        mountHeldItem: (item) => mounted.push(item.index),
      },
    },
    finish: () => finished++,
  };
  // Initial enter also notifies the generic state handler.
  owner.enterState = () => {};
  state.enter(owner);
  for (let frame = 0; frame < 16 && !finished; frame++) {
    state.execute(owner);
  }

  return {
    items,
    hidden,
    mounted,
    targets,
    restarts,
    finished,
    collectible,
  };
}

it("collects three distinct mushrooms over three complete animation cycles", () => {
  const result = runCluster();
  assert.deepEqual(result.mounted, [0, 1, 2]);
  assert.deepEqual(result.targets, [0, 0.2, 0.4]);
  assert.deepEqual(result.items.map(inventoryMushroomPart),
    ["Forest mushroom one", "Forest mushroom two", "Forest mushroom three"]);
  assert.deepEqual(result.hidden, [[0, false], [1, false], [2, true]]);
  assert.equal(new Set(result.items.map((item) => item.id)).size, 3);
  assert.equal(result.restarts, 3);
  assert.equal(result.finished, 1);
  assert.equal(result.collectible.canInteract, false);
});

it("leaves unpicked mushrooms when the inventory fills mid-cluster", () => {
  const result = runCluster(1);
  assert.deepEqual(result.mounted, [0]);
  assert.deepEqual(result.hidden, [[0, false]]);
  assert.equal(result.collectible.canInteract, true);
  assert.equal(result.finished, 1);
});

it("stops instead of repeating a rejected pickup", () => {
  const result = runCluster(12, false);
  assert.deepEqual(result.mounted, []);
  assert.deepEqual(result.hidden, []);
  assert.equal(result.restarts, 1);
  assert.equal(result.finished, 1);
});

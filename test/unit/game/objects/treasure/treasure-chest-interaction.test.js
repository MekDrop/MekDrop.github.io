import assert from "node:assert/strict";
import { it } from "node:test";
import { TreasureChestInteraction } from "../../../../../src/game/objects/treasure/TreasureChestInteraction.js";

it("opens the lid at hero hand contact and completes after recovery", () => {
  const target = {
    id: "1:2",
    x: 0,
    y: 2,
    z: 1,
  };
  let action;
  let opened = 0;
  let completed = 0;
  const interaction = new TreasureChestInteraction({
    target,
    field: {
      canOpen: () => true,
      open: (value) => {
        assert.equal(value, target);
        opened += 1;

        return true;
      },
    },
    hero: {
      isUsingTool: false,
      openChest: (options) => {
        action = options;

        return true;
      },
    },
    onComplete: () => {
      completed += 1;
    },
  });
  assert.equal(interaction.interact(), true);
  assert.equal(action.targetPosition, target);
  assert.equal(opened, 0);
  assert.equal(completed, 0);
  assert.equal(action.onImpact(), true);
  assert.equal(opened, 1);
  action.onComplete();
  assert.equal(completed, 1);
});

it("leaves the lid closed when the hero rejects the action", () => {
  let opened = false;
  const interaction = new TreasureChestInteraction({
    target: { id: "1:2" },
    field: {
      canOpen: () => true,
      open: () => {
        opened = true;
      },
    },
    hero: {
      isUsingTool: false,
      openChest: () => false,
    },
  });
  assert.equal(interaction.interact(), false);
  assert.equal(opened, false);
});

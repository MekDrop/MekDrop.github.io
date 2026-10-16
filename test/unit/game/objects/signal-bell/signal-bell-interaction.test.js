import assert from "node:assert/strict";
import { it } from "node:test";
import { SignalBellInteraction } from "../../../../../src/game/objects/signal-bell/SignalBellInteraction.js";

it("starts a hand action only within reach and reserves the bell through release", () => {
  let rings = 0;
  let completions = 0;
  const bell = {
    definition: { id: "bell" },
    position: {
      x: 2,
      y: 12,
      z: 3,
    },
    canRing: true,
    beginRinging() {
      this.canRing = false;
    },
    startPull: () => {},
    strike: () => {
      rings++;
    },
    endRinging() {
      this.canRing = true;
    },
  };
  const hero = {
    position: {
      x: 2,
      y: 9,
      z: 3,
    },
    isIncapacitated: false,
    isUsingTool: false,
    ringBell(action) {
      this.action = action;

      return true;
    },
  };
  const interaction = new SignalBellInteraction(bell, hero, () => {
    completions++;
  });
  assert.equal(interaction.interact(), false, "cannot ring from the room below");
  hero.position.y = 12;
  hero.position.x = 4;
  assert.equal(interaction.interact(), false, "cannot ring from across the rooftop");
  hero.position.x = 2.8;
  hero.isUsingTool = true;
  assert.equal(interaction.interact(), false);
  hero.isUsingTool = false;
  hero.isIncapacitated = true;
  assert.equal(interaction.interact(), false);
  hero.isIncapacitated = false;
  assert.equal(interaction.description.labelKey, "game.interaction.ring_bell");
  assert.equal(interaction.interact(), true);
  assert.equal(interaction.interact(), false, "one action per reservation");
  assert.equal(rings, 0, "E starts an action without an immediate strike");
  hero.action.onStart();
  hero.action.onStrike();
  assert.equal(rings, 1);
  assert.equal(completions, 1);
  hero.action.onEnd();
  assert.equal(interaction.interact(), true, "can ring again after release");
});

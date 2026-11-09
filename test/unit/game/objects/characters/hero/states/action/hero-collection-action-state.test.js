import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { HeroCollectingActionState, HeroInventoryFullActionState } from "../../../../../../../../src/game/objects/characters/hero/states/action/HeroCollectionActionState.js";
import { HeroActionBehavior } from "../../../../../../../../src/game/objects/characters/hero/behaviors/action/HeroActionBehavior.js";
import { HERO_PICKUP_ACTIONS } from "../../../../../../../../src/game/config/hero-pickup-actions.js";
import { HERO_ANIMATION } from "../../../../../../../../src/game/enum/HeroAnimation.js";

/**
 * Use the real state machine so completion and forced interruption exercise exit.
 */
function createFixture() {
  const events = [];
  const pose = {
    position: new Vec3(),
    facingDirection: new Vec3(0, 0, 1),
    leftAttachment: "left-glove",
    rightAttachment: "right-glove",
  };
  const host = {
    readPose: () => pose,
    setFacingYaw: (yaw) => {
      events.push(["face", yaw]);
      pose.facingDirection.set(Math.sin(yaw * Math.PI / 180), 0, Math.cos(yaw * Math.PI / 180));
    },
  };
  const feedback = {
    positioningDuration: 0.2,
    fullEffectTime: 0.1,
    fullDuration: 0.2,
    canOccupy: () => true,
    moveTo: (x, z) => pose.position.set(x, 0, z),
    mountHeldItem: () => events.push("mount-item"),
    mountTool: () => events.push("mount-tool"),
    begin: () => events.push("begin"),
    restartAnimation: () => events.push("restart"),
    playPickupSound: () => events.push("pickup-sound"),
    showInventoryFull: () => events.push("full"),
  };
  const behavior = new HeroActionBehavior({ feedback: { collection: feedback } });

  return {
    pose,
    host,
    feedback,
    behavior,
    events,
  };
}

it("plans tool-specific pickups with the authored timing and glove attachment", () => {
  const { host } = createFixture();
  const tool = { visible: false };
  const options = {
    targetPosition: new Vec3(0, 0, 2),
    tool,
  };
  assert.equal(HeroCollectingActionState.createPickup("unknown", options, host), null);
  assert.equal(HeroCollectingActionState.createPickup("mushroom", {
    targetPosition: options.targetPosition,
  }, host), null);
  const flower = HeroCollectingActionState.createPickup("flower", options, host);
  assert.equal(flower.tool, null);
  assert.equal(flower.heldItemAttachmentEntity, "right-glove");
  assert.equal(flower.positioning.targetZ, HERO_PICKUP_ACTIONS.flower.maximumForwardStep);
  const mushroom = HeroCollectingActionState.createPickup("mushroom", options, host);
  assert.equal(mushroom.tool, tool);
  assert.equal(mushroom.heldItemAttachmentEntity, "left-glove");
  assert.equal(mushroom.impactTime, HERO_PICKUP_ACTIONS.mushroom.impactTime);
  assert.equal(mushroom.cutStartTime, HERO_PICKUP_ACTIONS.mushroom.cutStartTime);
  assert.equal(mushroom.positioning.targetZ, HERO_PICKUP_ACTIONS.mushroom.maximumStep);
});

it("uses a backward approach for a coincident chest and skips negligible pickup steps", () => {
  const { host } = createFixture();
  const chest = HeroCollectingActionState.createChest({ targetPosition: new Vec3() }, host);
  assert.equal(chest.animation, HERO_ANIMATION.OPEN_CHEST);
  assert.equal(chest.positioning.targetZ, -0.535);
  assert.equal(chest.positioning.targetX, 0);
  const flower = HeroCollectingActionState.createPickup("flower", {
    targetPosition: new Vec3(0, 0, HERO_PICKUP_ACTIONS.flower.targetDistance + 0.01),
  }, host);
  assert.equal(flower.positioning, null);
});

it("retargets chained pickups from the latest position rather than a captured pose", () => {
  const { host, pose, behavior, events } = createFixture();
  const first = {
    follow: () => {},
    destroy: () => events.push("destroy-first"),
  };
  const second = {
    follow: () => {},
    destroy: () => events.push("destroy-second"),
  };
  const action = HeroCollectingActionState.createPickup("flower", {
    targetPosition: new Vec3(0, 0, 0.25),
    heldItem: first,
    nextHeldItem: () => second,
    nextTargetPosition: () => {
      pose.position = new Vec3(4, 0, 5);

      return new Vec3(5, 0, 5);
    },
    onImpact: () => true,
  }, host);
  behavior.collectAction = action;
  behavior.update(action.duration);
  assert.equal(action.heldItem, second);
  assert.equal(action.elapsed, 0);
  assert.equal(action.impacted, false);
  assert.equal(action.positioning.startX, 4);
  assert.equal(action.positioning.startZ, 5);
  assert.equal(action.positioning.targetX, 4.55);
  assert.deepEqual(events.filter((event) => event === "destroy-first"), ["destroy-first"]);
  behavior.collectAction = null;
  assert.ok(events.includes("destroy-second"));
  assert.equal(action.heldItem, null);
});

it("cleans up an interrupted collection without reporting successful completion", () => {
  const { host, behavior, events } = createFixture();
  const tool = { visible: false };
  const action = HeroCollectingActionState.createPickup("mushroom", {
    targetPosition: new Vec3(0, 0, HERO_PICKUP_ACTIONS.mushroom.targetDistance),
    tool,
    heldItem: { destroy: () => events.push("destroy-item") },
    onComplete: () => events.push("complete"),
  }, host);
  behavior.collectAction = action;
  assert.equal(tool.visible, true);
  assert.ok(events.includes("mount-tool"));
  behavior.collectAction = null;
  behavior.collectAction = null;
  assert.equal(tool.visible, false);
  assert.equal(action.heldItem, null);
  assert.deepEqual(events.slice(-2), ["destroy-item", "restart"]);
  assert.equal(events.includes("pickup-sound"), false);
  assert.equal(events.includes("complete"), false);
});

it("finishes chest impact, sound, animation reset and callback exactly once in order", () => {
  const { host, behavior, events } = createFixture();
  const action = HeroCollectingActionState.createChest({
    targetPosition: new Vec3(0, 0, 0.535),
    onImpact: () => {
      events.push("impact");

      return true;
    },
    onComplete: () => events.push("complete"),
  }, host);
  behavior.collectAction = action;
  events.length = 0;
  behavior.update(action.duration + 1);
  behavior.update(1);
  assert.deepEqual(events, ["impact", "pickup-sound", "restart", "complete"]);
  assert.equal(behavior.collectAction, null);
});

it("keeps a blocked approach from advancing pickup impact in that frame", () => {
  const { host, behavior, feedback, events } = createFixture();
  const action = HeroCollectingActionState.createChest({
    targetPosition: new Vec3(0, 0, 2),
    onImpact: () => events.push("impact"),
  }, host);
  feedback.canOccupy = () => false;
  behavior.collectAction = action;
  behavior.update(1);
  assert.equal(action.positioning, null);
  assert.equal(action.elapsed, 0);
  assert.equal(events.includes("impact"), false);
  behavior.update(1);
  assert.equal(events.includes("impact"), true);
});

it("owns inventory refusal planning, notification and completion without pickup resources", () => {
  const { host, behavior, events } = createFixture();
  const action = HeroInventoryFullActionState.createPayload("flower", {
    onComplete: () => events.push("complete"),
  }, host);
  assert.equal(action.positioning, null);
  behavior.inventoryFullAction = action;
  events.length = 0;
  behavior.update(1);
  behavior.update(1);
  assert.deepEqual(events, ["full", "restart", "complete"]);
  const interrupted = HeroInventoryFullActionState.createPayload("flower", {
    targetPosition: new Vec3(0, 0, 2),
    onComplete: () => events.push("unexpected-completion"),
  }, host);
  assert.equal(interrupted.positioning.targetZ, 0.55);
  behavior.inventoryFullAction = interrupted;
  behavior.inventoryFullAction = null;
  assert.equal(events.includes("unexpected-completion"), false);
});

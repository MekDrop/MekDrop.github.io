import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroLocomotion } from "../../../../../../src/game/objects/characters/hero/HeroLocomotion.js";

const motion = {
  enabled: true,
  moving: true,
  running: false,
  speed: 1.8,
  walkSpeed: 1.8,
  runSpeed: 3.4,
  phase: 0.2,
};

it("accelerates through walking before running, and slows through running before walking", () => {
  const gait = new HeroLocomotion();
  assert.equal(gait.update(0.016, {
    ...motion,
    running: true,
  }), "Walk");
  assert.equal(gait.update(0.016, {
    ...motion,
    running: true,
    speed: 2.6,
  }), "Run");
  assert.equal(gait.state, "accelerating");
  gait.update(0.016, {
    ...motion,
    running: true,
    speed: 3.4,
  });
  assert.equal(gait.state, "running");
  assert.equal(gait.update(0.016, {
    ...motion,
    speed: 2.8,
  }), "Run");
  assert.equal(gait.state, "slowing");
  assert.equal(gait.update(0.016, motion), "Walk");
});

it("finishes the braking step after velocity reaches zero and can resume immediately", () => {
  const gait = new HeroLocomotion();
  gait.update(0.016, {
    ...motion,
    running: true,
    speed: 3.4,
  });
  assert.equal(gait.update(0.016, {
    ...motion,
    moving: false,
    speed: 3.2,
  }), "RunStopLeft");
  assert.equal(gait.update(0.15, {
    ...motion,
    moving: false,
    speed: 0,
  }), "RunStopLeft");
  assert.equal(gait.state, "stopping");
  assert.equal(gait.update(0.016, motion), "Walk");
  gait.update(0.016, {
    ...motion,
    running: true,
    speed: 3.4,
    phase: 0.7,
  });
  assert.equal(gait.update(0.016, {
    ...motion,
    moving: false,
    speed: 3.2,
    phase: 0.7,
  }), "RunStopRight");
  assert.equal(gait.update(0.5, {
    ...motion,
    moving: false,
    speed: 0,
  }), "Idle");
});

it("actions interrupt braking and ordinary walking does not play a running stop", () => {
  const gait = new HeroLocomotion();
  gait.update(0.016, motion);
  assert.equal(gait.update(0.016, {
    ...motion,
    moving: false,
    speed: 0,
  }), "Idle");
  gait.update(0.016, {
    ...motion,
    running: true,
    speed: 3.4,
  });
  gait.update(0.016, {
    ...motion,
    moving: false,
    speed: 3,
  });
  assert.equal(gait.update(0.016, {
    ...motion,
    enabled: false,
  }), null);
  assert.equal(gait.state, "idle");
});

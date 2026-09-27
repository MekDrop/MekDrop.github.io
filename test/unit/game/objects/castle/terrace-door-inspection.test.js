import assert from "node:assert/strict";
import { it } from "node:test";
import { State } from "yuka";
import { ServantStateMachine } from "../../../../../src/game/objects/castle/ServantStateMachine.js";
import { TerraceDoorInspection } from "../../../../../src/game/objects/castle/TerraceDoorInspection.js";
import { ServantWaitState } from "../../../../../src/game/objects/castle/states/servant/ServantWaitState.js";
import { ServantNoticeState } from "../../../../../src/game/objects/castle/states/servant/ServantNoticeState.js";
import { ServantLookLeftState } from "../../../../../src/game/objects/castle/states/servant/ServantLookLeftState.js";
import { ServantCloseState } from "../../../../../src/game/objects/castle/states/servant/ServantCloseState.js";

it("uses distinct Yuka states to notice, inspect, and close the door", () => {
  const notice = new ServantNoticeState({
    phase: "notice",
    duration: 1,
    nextPhase: "walk-out",
  });
  const look = new ServantLookLeftState({
    phase: "look-left",
    duration: 1,
    nextPhase: "look-right",
  });
  const close = new ServantCloseState({
    phase: "close",
    duration: 1,
    nextPhase: "release",
  });
  assert.ok(notice instanceof State);
  assert.ok(look instanceof State);
  assert.ok(close instanceof State);
  assert.notEqual(notice.constructor, look.constructor);
  assert.notEqual(look.constructor, close.constructor);
  assert.equal(notice.nextPhase, "walk-out");
  assert.equal(notice.action, "notice");
  assert.equal(notice.animation, "idle");
  assert.equal(look.nextPhase, "look-right");
  assert.equal(look.action, "look-left");
  assert.equal(look.animation, "turn");
  assert.equal(close.nextPhase, "release");
  assert.equal(close.action, "close");
  assert.equal(close.animation, "closeDoor");
});

it("reuses servant states in another interruptible sequence", () => {
  const sequence = new ServantStateMachine({
    idlePhase: "idle",
    initialPhase: "wait-for-task",
    states: [
      new ServantWaitState({
        phase: "wait-for-task",
        duration: 2,
        nextPhase: "work",
      }),
      new ServantNoticeState({ phase: "work", duration: 4, nextPhase: "idle" }),
      new ServantLookLeftState({
        phase: "distracted",
        duration: 1,
        nextPhase: null,
      }),
    ],
  });
  sequence.start();
  sequence.update(1);
  assert.equal(sequence.interrupt("distracted"), true);
  assert.equal(sequence.phase, "distracted");
  assert.equal(sequence.action, "look-left");
  assert.equal(sequence.animation, "turn");
  assert.equal(sequence.interrupted, true);
  sequence.update(1);
  assert.equal(sequence.phase, "wait-for-task");
  assert.equal(sequence.elapsed, 1);
  assert.equal(sequence.interrupted, false);
  sequence.update(1);
  assert.equal(sequence.phase, "work");
});

it("waits 30 seconds, checks both sides, returns inside, then closes", () => {
  const inspection = new TerraceDoorInspection();
  assert.equal(inspection.start(), true);
  inspection.update(29.9);
  assert.equal(inspection.phase, "wait");
  assert.equal(inspection.animation, "idle");
  assert.equal(inspection.doorOpen, true);
  inspection.update(0.1);
  assert.equal(inspection.phase, "notice");
  for (const [seconds, phase, animation] of [
    [1.2, "walk-out", "walk"],
    [3, "look-left", "turn"],
    [1.8, "look-right", "turn"],
    [2.4, "return", "walk"],
    [2, "grasp", "closeDoor"],
    [0.7, "close", "closeDoor"],
  ]) {
    assert.equal(inspection.doorOpen, true);
    inspection.update(seconds);
    assert.equal(inspection.phase, phase);
    assert.equal(inspection.animation, animation);
  }
  assert.equal(inspection.doorOpen, false);
  inspection.update(2);
  assert.equal(inspection.phase, "release");
  assert.equal(inspection.doorOpen, false);
  inspection.update(0.5);
  assert.equal(inspection.phase, "leave");
  inspection.update(1.8);
  assert.equal(inspection.active, false);
  assert.equal(inspection.start(), true);
});

it("repeat clicks cannot delay the servant and traffic cannot be closed on", () => {
  const inspection = new TerraceDoorInspection();
  inspection.start();
  inspection.update(29);
  assert.equal(inspection.start(), false);
  inspection.update(2, true);
  assert.equal(inspection.phase, "wait");
  assert.equal(inspection.elapsed, 30);
  assert.equal(inspection.doorOpen, true);
  inspection.update(0.1, false);
  assert.equal(inspection.phase, "notice");
  assert.ok(inspection.elapsed < 0.11);
});

it("handles coarse updates, invalid deltas and reset without delayed callbacks", () => {
  const inspection = new TerraceDoorInspection();
  inspection.start();
  for (const delta of [NaN, Infinity, -1, 0]) {
    inspection.update(delta);
  }
  assert.equal(inspection.elapsed, 0);
  inspection.update(100);
  assert.equal(inspection.active, false);
  inspection.start();
  inspection.update(35);
  inspection.reset();
  inspection.update(100);
  assert.equal(inspection.phase, "idle");
  assert.equal(inspection.doorOpen, false);
});

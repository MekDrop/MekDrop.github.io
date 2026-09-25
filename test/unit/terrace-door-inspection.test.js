import assert from "node:assert/strict";
import { it } from "node:test";
import { TerraceDoorInspection } from "../../src/game/objects/castle/TerraceDoorInspection.js";

it("waits 30 seconds, checks both sides, returns inside, then closes", () => {
  const inspection = new TerraceDoorInspection();
  assert.equal(inspection.start(), true);
  inspection.update(29.9);
  assert.equal(inspection.phase, "wait");
  assert.equal(inspection.doorOpen, true);
  inspection.update(0.1);
  assert.equal(inspection.phase, "notice");
  for (const [seconds, phase] of [[1.2, "walk-out"], [3, "look-left"],
    [1.8, "look-right"], [2.4, "return"], [2, "grasp"], [0.7, "close"]]) {
    assert.equal(inspection.doorOpen, true);
    inspection.update(seconds);
    assert.equal(inspection.phase, phase);
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

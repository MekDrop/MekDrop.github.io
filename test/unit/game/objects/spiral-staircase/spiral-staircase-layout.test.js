import assert from "node:assert/strict";
import { test } from "node:test";
import { SpiralStaircaseLayout } from "../../../../../src/game/objects/spiral-staircase/SpiralStaircaseLayout.js";

test("spiral stairs land exactly at both integer and fractional upper levels", () => {
  for (const [Z1, Z2] of [[2, 3], [2, 4], [3, 7], [-2, 0.03]]) {
    const steps = SpiralStaircaseLayout.steps({ Z1, Z2, rotation: 90 });
    assert.equal(steps.at(-1).height, Z2);
    assert.equal(steps[0].rotation, 90);
    let previous = Z1;
    for (const step of steps) {
      assert.ok(step.height > previous);
      assert.ok(step.height - previous <= 0.140001);
      previous = step.height;
    }
    // A full revolution leaves at least 2.1 units below the next tread,
    // comfortably above the hero's 1.45-unit collision height.
    for (let index = 16; index < steps.length; index += 1) {
      assert.ok(steps[index].height - steps[index - 16].height - 0.114 > 1.45);
    }
  }
});

test("invalid and excessive heights fail before generating entities", () => {
  for (const [Z1, Z2] of [[0, 0], [2, 1], [0, Infinity], [NaN, 2], [0, 65]]) {
    assert.throws(() => SpiralStaircaseLayout.steps({ id: "invalid", Z1, Z2 }),
      { name: "InvalidSpiralStaircaseError" });
  }
});

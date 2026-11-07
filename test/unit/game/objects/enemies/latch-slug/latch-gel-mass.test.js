import assert from "node:assert/strict";
import test from "node:test";
import { LatchGelMass } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGelMass.js";

test("lost mass fades only after recoil and every scoop increases transparency", () => {
  const owner = {
    alive: true,
    scoopGel: {
      active: true,
      bug: { scoop: { time: 0.7 } },
    },
  };
  const mass = new LatchGelMass(owner);
  mass.removeScoop();
  mass.update(0.2);
  assert.equal(mass.opacity, 0.82);
  owner.scoopGel.bug.scoop.time = 1.05;
  let previous = mass.opacity;
  for (let i = 1; i <= 9; i++) {
    if (i > 1) {
      mass.removeScoop();
    }
    mass.update(2);
    assert.ok(mass.opacity < previous);
    assert.ok(mass.opacity >= 0.32, "the remaining yellow body must stay visible");
    previous = mass.opacity;
  }
  assert.ok(Math.abs(mass.opacity - 0.32) < 1e-7);
  mass.update(NaN);
  assert.equal(mass.opacity, previous);
});

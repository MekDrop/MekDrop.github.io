import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroStepPresentation } from "../../../../../../src/game/objects/characters/hero/HeroStepPresentation.js";

it("keeps the visible body on the lower tread during an aborted short step", () => {
  let offset = -0.265;
  for (const height of [2.765, 2.765, 2.74, 2.66, 2.55, 2.52]) {
    offset = HeroStepPresentation.update(offset, height, 2.5, 2.5, 1 / 60, 0.32);
    assert.ok(Math.abs(height + offset - 2.515) < 1e-8);
  }
});

it("eases onto the higher tread after the physical centre crosses the riser", () => {
  let offset = -0.265;
  for (let frame = 0; frame < 30; frame++) {
    const next = HeroStepPresentation.update(offset, 2.765, 2.75, 2.5, 1 / 60, 0.32);
    assert.ok(next > offset && next <= 0);
    offset = next;
  }
  assert.ok(Math.abs(offset) < 0.001);
});

it("does not cancel an actual fall or turn a missing surface into support", () => {
  const released = HeroStepPresentation.update(-0.2, 3, null, 2.5, 1 / 60, 0.32);
  assert.ok(released > -0.2 && released < 0);
});

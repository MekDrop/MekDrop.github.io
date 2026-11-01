import assert from "node:assert/strict";
import { it } from "node:test";
import { LatchFootprint } from "../../../../../../src/game/objects/enemies/latch-slug/LatchFootprint.js";

it("keeps drops with overlapping bounds separate until their actual film meets", () => {
  const left = new LatchFootprint([0, 0, 1, 0, 0, 1], [0, 1, 2]);
  const separate = new LatchFootprint([1, 1, 1, 0.3, 0.3, 1], [0, 1, 2]);
  const touching = new LatchFootprint([1, 1, 1, 0, 0, 1], [0, 1, 2]);
  assert.equal(left.touches(separate), false);
  assert.equal(separate.touches(left), false);
  assert.equal(left.touches(touching), true);
});

it("detects containment and thin wet trails between drops", () => {
  const drop = new LatchFootprint([-0.5, 0, 0.5, 0, 0, 1], [0, 1, 2]);
  const inside = new LatchFootprint([-0.01, 0.3, 0.01, 0.3, 0, 0.4], [0, 1, 2]);
  const trail = new LatchFootprint([0, 0.5, 0.01, 0.5, 0, 2], [0, 1, 2]);
  assert.equal(drop.touches(inside), true);
  assert.equal(drop.touches(trail), true);
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroTurning } from "../../../../../../src/game/objects/characters/hero/HeroTurning.js";

it("crosses the angle seam by the short route even after multiple revolutions", () => {
  assert.equal(HeroTurning.difference(1079, -719), 2);
  assert.equal(HeroTurning.difference(-1079, 719), -2);
  assert.ok(HeroTurning.advance(179, -179, 1 / 60) > 179);
});

it("bounds a reversal at low and high frame rates and settles without overshoot", () => {
  for (const fps of [30, 60, 144]) {
    let yaw = 0;
    for (let frame = 0; frame < fps; frame++) {
      const next = HeroTurning.advance(yaw, 180, 1 / fps);
      assert.ok(Math.abs(next - yaw) <= 540 / fps + 1e-8);
      assert.ok(Math.abs(HeroTurning.difference(next, 180)) <=
        Math.abs(HeroTurning.difference(yaw, 180)));
      yaw = next;
    }
    assert.ok(Math.abs(HeroTurning.difference(yaw, 180)) < 0.01);
  }
});

it("brakes sharp pivots and restores full speed when aligned", () => {
  assert.equal(HeroTurning.speedScale(0, 0), 1);
  assert.equal(HeroTurning.speedScale(0, 180), 0.12);
  assert.ok(HeroTurning.speedScale(0, 45) > HeroTurning.speedScale(0, 90));
  assert.equal(HeroTurning.speedScale(360, 180), HeroTurning.speedScale(0, 180));
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroFootSupport } from "../../../../../src/game/objects/hero/HeroFootSupport.js";

const north = { x: 0, z: -1 };

it("identifies the unsupported boot and preserves the caller's alternating refusal foot", () => {
  const feet = new HeroFootSupport({ supportHeightAtPoint: (x) => x >= 0 ? 2 : null });
  assert.equal(feet.unsupportedFootAt(0, 0, 2, north), "right");
  assert.equal(feet.unsupportedFootAt(0, 0, 2, { x: 0, z: 1 }), "left");
  assert.equal(feet.unsupportedFootAt(-1, 0, 2, north, "right"), "right");
  assert.equal(feet.unsupportedFootAt(-1, 0, 2, north, "left"), "left");
  assert.equal(feet.unsupportedFootAt(1, 0, 2, north), null);
});

it("requires boot center support even when its perimeter is supported", () => {
  const feet = new HeroFootSupport({ supportHeightAtPoint: (x, z) => Math.abs(x - 0.13) < 0.001 && Math.abs(z + 0.1) < 0.001 ? null : 2 });
  assert.equal(feet.unsupportedFootAt(0, 0, 2, north), "left");
});

it("accepts one missing sole corner but rejects two missing perimeter samples", () => {
  let cutBothFrontCorners = false;
  const feet = new HeroFootSupport({ supportHeightAtPoint: (x, z) => z < -0.27 && (cutBothFrontCorners || x > 0.2) ? null : 2 });
  assert.equal(feet.unsupportedFootAt(0, 0, 2, north), null);
  cutBothFrontCorners = true;
  assert.equal(feet.unsupportedFootAt(0, 0, 2, north, "right"), "right");
});

it("settles forward only when both boot centers are already on support", () => {
  const feet = new HeroFootSupport({ supportHeightAtPoint: (_x, z) => z <= 0 ? 2 : null });
  assert.notEqual(feet.unsupportedFootAt(0, 0, 2, north), null);
  const settled = feet.fullySupportedPositionAhead(0, 0, 2, north);
  assert.ok(settled.z < 0 && settled.z >= -0.28);
  assert.equal(feet.unsupportedFootAt(settled.x, settled.z, 2, north), null);
  assert.equal(feet.fullySupportedPositionAhead(0, 0.2, 2, north), null);
});

it("allows an even one-level descent but rejects deep, split and missing support", () => {
  let heightAt = () => 1;
  const feet = new HeroFootSupport({ supportHeightAtPoint: (x, z) => heightAt(x, z) });
  assert.equal(feet.isSafeDescentAt(0, 0, 2, north), true);
  heightAt = () => 0;
  assert.equal(feet.isSafeDescentAt(0, 0, 2, north), false);
  heightAt = (x) => x < 0 ? 1 : 1.5;
  assert.equal(feet.isSafeDescentAt(0, 0, 2, north), false);
  heightAt = (x) => x < 0 ? null : 1;
  assert.equal(feet.isSafeDescentAt(0, 0, 2, north), false);
  heightAt = () => 2;
  assert.equal(feet.isSafeDescentAt(0, 0, 2, north), false);
});

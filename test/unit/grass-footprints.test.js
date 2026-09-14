import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GrassFootprints } from "../../src/game/objects/ground-cover/GrassFootprints.js";

function foot(side, x, pressure = 1) {
  return { side, x, y: 2.15, z: 0, pressure, directionX: 0, directionZ: 1, halfWidth: 0.12, halfLength: 0.2 };
}

describe("grass foot impressions", () => {
  it("keeps separate planted soles pressed without accumulating stationary trails", () => {
    const impressions = new GrassFootprints();
    for (let frame = 0; frame < 180; frame++) {
      impressions.update(1 / 60, [foot("left", -0.15), foot("right", 0.15)]);
    }
    assert.equal(impressions.positions[3], 1);
    assert.equal(impressions.positions[7], 1);
    assert.ok(impressions.positions.slice(8).every((value) => value === 0));
  });

  it("leaves a fading depression at the old foot position after a step", () => {
    const impressions = new GrassFootprints();
    impressions.update(0, [foot("left", 0)]);
    impressions.update(0.1, [foot("left", 0.25)]);
    assert.equal(impressions.positions[0], 0.25);
    assert.equal(impressions.positions[4], 0);
    assert.equal(impressions.positions[7], 1);
    impressions.update(0.4, [foot("left", 0.25)]);
    assert.ok(impressions.positions[7] > 0 && impressions.positions[7] < 1);
    impressions.update(0.5, [foot("left", 0.25)]);
    assert.equal(impressions.positions[7], 0);
  });

  it("releases lifted feet and never stamps an airborne sole", () => {
    const impressions = new GrassFootprints();
    impressions.update(0, [foot("left", 0)]);
    impressions.update(0.1, [foot("left", 2, 0)]);
    assert.equal(impressions.positions[0], 0);
    assert.equal(impressions.positions[3], 1);
    impressions.update(0.9, []);
    assert.ok(impressions.positions.every((value) => value === 0));
  });

  it("bounds history during running and retains sole orientation and elevation", () => {
    const impressions = new GrassFootprints();
    for (let step = 0; step < 50; step++) {
      impressions.update(0.01, [foot("left", step * 0.2), foot("right", step * 0.2 + 0.15)]);
    }
    assert.equal(impressions.positions.length, 32);
    assert.equal(impressions.shapes.length, 32);
    assert.ok(Math.abs(impressions.positions[1] - 2.15) < 0.00001);
    assert.equal(impressions.shapes[1], 1);
    assert.ok(impressions.positions.every(Number.isFinite));
  });
});

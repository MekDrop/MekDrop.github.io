import assert from "node:assert/strict";
import { it } from "node:test";
import { castleStraightStairHeight, castleStraightStairSurfaces, castleStraightStairStepCount } from "../../../../../src/game/objects/castle/CastleStraightStairs.js";

it("provides deep, level tread centres within the automatic step clearance", () => {
  const stair = { radius: 1.35, rise: 3, yaw: 0, center: { x: 0, y: 0, z: 0 } };
  for (const surface of castleStraightStairSurfaces(stair).filter(s => s.high > s.low)) {
    const count = castleStraightStairStepCount(surface);
    const depth = (surface.maxZ - surface.minZ) / count;
    const riser = (surface.high - surface.low) / count;
    assert.ok(depth >= 0.37);
    assert.ok(riser <= 0.32);
    for (let index = 0; index < count; index++) {
      const z = surface.reverse ? surface.maxZ - depth * (index + 0.5) : surface.minZ + depth * (index + 0.5);
      const y = surface.low + riser * (index + 1);
      for (const offset of [-0.1, 0, 0.1]) {
        assert.ok(Math.abs(castleStraightStairHeight(stair, (surface.minX + surface.maxX) / 2, z + offset, y) - y) < 1e-9);
      }
    }
  }
});

it("supports ascent and descent through a turning landing in every orientation", () => {
  for (const yaw of [0, 90, 180, 270]) {
    const stair = { radius: 1.35, rise: 3, yaw, center: { x: 7, y: -3, z: -5 } };
    const route = [[-0.675, 1.35, -3], [-0.675, -0.675, -1.5],
      [-0.675, -1.0125, -1.5], [0.675, -1.0125, -1.5],
      [0.675, -0.675, -1.5], [0.675, 1.215, 0], [0.675, 1.35, 0]];
    for (const points of [route, [...route].reverse()]) {
      let elevation = points[0][2];
      for (let segment = 1; segment < points.length; segment++) {
        const a = points[segment - 1], b = points[segment];
        for (let sample = 0; sample <= 40; sample++) {
          const t = sample / 40;
          const localX = a[0] + (b[0] - a[0]) * t;
          const localZ = a[1] + (b[1] - a[1]) * t;
          const angle = yaw * Math.PI / 180;
          const x = stair.center.x + localX * Math.cos(angle) + localZ * Math.sin(angle);
          const z = stair.center.z - localX * Math.sin(angle) + localZ * Math.cos(angle);
          const height = castleStraightStairHeight(stair, x, z, elevation);
          assert.notEqual(height, null, `continuous support at yaw ${yaw}`);
          assert.ok(Math.abs(height - (a[2] + (b[2] - a[2]) * t)) <= 0.300001);
          elevation = height;
        }
      }
      assert.ok(Math.abs(elevation - points.at(-1)[2]) <= 0.300001);
    }
    assert.equal(castleStraightStairHeight(stair, 100, 100, 0), null);
  }
});

it("moves flights outward without narrowing their treads or closing the turning landing", () => {
  const stair = { radius: 1.35, rise: 3, flightGap: 0.5, yaw: 0, center: { x: 0, y: 0, z: 0 } };
  const [lower, landing, upper] = castleStraightStairSurfaces(stair);
  assert.equal(lower.maxX, -0.25);
  assert.equal(upper.minX, 0.25);
  assert.ok(Math.abs(lower.maxX - lower.minX - stair.radius) < 1e-9);
  assert.ok(Math.abs(upper.maxX - upper.minX - stair.radius) < 1e-9);
  assert.equal(castleStraightStairHeight(stair, 0, 0, 0.3), null);
  for (const x of [-0.925, 0, 0.925]) {
    assert.equal(castleStraightStairHeight(stair, x, (landing.minZ + landing.maxZ) / 2, 1.5), 1.5);
  }
});

it("aligns the raised landing with both adjoining tread tops", () => {
  const stair = { radius: 1.35, rise: 3, landingLift: 0.3 };
  const [incoming, landing, outgoing] = castleStraightStairSurfaces(stair);
  assert.equal(incoming.high, landing.high);
  const firstOutgoing = outgoing.low + (outgoing.high - outgoing.low) / castleStraightStairStepCount(outgoing);
  assert.equal(firstOutgoing, landing.high);
  assert.ok(incoming.high / castleStraightStairStepCount(incoming) <= 0.32);
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { RoyalGameOverRouteFollower } from "../../../../../src/game/objects/castle/RoyalGameOverRouteFollower.js";

const ROUTE = Object.freeze([
  Object.freeze({ x: 0, y: 0.2, z: 0 }),
  Object.freeze({ x: 0, y: 0.2, z: 1 }),
  Object.freeze({ x: 1, y: 0.3, z: 1 }),
]);

function createFollower() {
  return new RoyalGameOverRouteFollower({
    waypoints: ROUTE,
    duration: 2,
  });
}

function assertPoseClose(actual, expected, epsilon = 0.0000001) {
  for (const key of ["x", "y", "z"]) {
    assert.ok(Math.abs(actual.position[key] - expected.position[key]) < epsilon);
  }
  for (const key of ["x", "y", "z", "w"]) {
    assert.ok(Math.abs(actual.rotation[key] - expected.rotation[key]) < epsilon);
  }
}

it("uses Yuka steering to follow each authored route leg", () => {
  const follower = createFollower();

  const beforeCorner = follower.advance(0.25);
  const afterCorner = follower.advance(0.5);

  assert.ok(beforeCorner.position.z > 0.45);
  assert.ok(Math.abs(beforeCorner.position.x) < 0.01);
  assert.ok(afterCorner.position.x > 0.04);
  assert.ok(afterCorner.position.z > 0.94);
  assert.ok(Math.abs(afterCorner.rotation.y) > 0.6);
  assert.ok(Math.abs(afterCorner.rotation.x) < 0.0000001);
  assert.ok(Math.abs(afterCorner.rotation.z) < 0.0000001);
});

it("advances deterministically regardless of presentation update slices", () => {
  const direct = createFollower();
  const sliced = createFollower();

  const directPose = direct.advance(0.72);
  for (const progress of [0.1, 0.24, 0.39, 0.55, 0.72]) {
    sliced.advance(progress);
  }

  assertPoseClose(sliced.pose, directPose);
});

it("finishes at the authored destination on the animation deadline", () => {
  const follower = createFollower();

  const almostFinished = follower.advance(0.99);
  const pose = follower.advance(1);

  assert.ok(almostFinished.position.x > 0.95);
  assert.deepEqual(pose.position, ROUTE.at(-1));
});

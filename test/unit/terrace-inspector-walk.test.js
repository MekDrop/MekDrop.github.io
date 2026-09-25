import assert from "node:assert/strict";
import { it } from "node:test";
import { TerraceInspectorWalk } from "../../src/game/objects/castle/TerraceInspectorWalk.js";
const route = {
  start: { x: 0, y: 0, z: 0.72 }, end: { x: -0.4, y: 0, z: 0.8 },
  startYaw: 90, endYaw: -100, duration: 3, scale: 0.45,
};
it("turns in place first, then faces the travel direction while approaching the handle", () => {
  const turn = TerraceInspectorWalk.sample({ ...route, elapsed: 0.2 });
  assert.equal(turn.action, "turn");
  assert.equal(turn.x, route.start.x);
  assert.equal(turn.z, route.start.z);
  const walk = TerraceInspectorWalk.sample({ ...route, elapsed: 1.5 });
  assert.equal(walk.action, "walk");
  const heading = Math.atan2(-0.4, 0.08) * 180 / Math.PI;
  assert.ok(Math.abs(walk.yaw - heading) < 0.0001);
  const end = TerraceInspectorWalk.sample({ ...route, elapsed: 3 });
  assert.equal(end.x, route.end.x);
  assert.equal(end.z, route.end.z);
  assert.ok(Math.abs(end.yaw - route.endYaw) < 0.0001);
});
it("advances footsteps with traveled distance rather than wall-clock time", () => {
  const start = TerraceInspectorWalk.sample({ ...route, elapsed: 1 });
  const end = TerraceInspectorWalk.sample({ ...route, elapsed: 2 });
  assert.equal(start.action, "walk");
  assert.equal(end.action, "walk");
  assert.ok(Math.abs(start.animationTime / start.progress - end.animationTime / end.progress) < 0.0001);
  const slower = TerraceInspectorWalk.sample({ ...route, duration: 5, elapsed: 5 });
  assert.equal(slower.x, route.end.x);
  assert.equal(slower.z, route.end.z);
});

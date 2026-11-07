import assert from "node:assert/strict";
import test from "node:test";
import { EventHandler, Vec3 } from "playcanvas";
import { BellBugScoopPose } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugScoopPose.js";

test("surface, toe and pulled gel share one contact and restore each render", () => {
  const app = new EventHandler();
  const goals = [], gel = [];
  const point = new Vec3(0.16, 0.24, -0.4);
  const contact = {
    active: true,
    point,
    pose: (time, goal) => gel.push(goal.clone()),
  };
  const owner = {
    app,
    entity: { forward: new Vec3(0, 0, -1) },
    scoop: {
      target: {},
      contact,
      side: 0,
      time: 0.45,
    },
  };
  const model = { findByName: () => ({ getPosition: () => new Vec3(0, 0.3, 0) }) };
  const pose = new BellBugScoopPose(owner, model);
  let restores = 0;
  const foot = {
    source: {},
    point: new Vec3(),
    pose: goal => goals.push(goal.clone()),
    restore: () => restores++,
    destroy: () => {},
  };
  pose.feet.set(0, foot);
  pose.feet.set(1, foot);
  app.fire("prerender");
  assert.ok(goals[0].distance(point) < 1e-8);
  assert.ok(gel[0].equals(goals[0]));
  app.fire("postrender");
  assert.ok(restores > 0);
  owner.scoop.side = 1;
  owner.scoop.time = 0.92;
  app.fire("prerender");
  assert.ok(goals[1].distance(new Vec3(0, 0.3, -0.08)) < 1e-8);
  assert.ok(gel[1].equals(goals[1]));
  pose.destroy();
  app.fire("prerender");
  assert.equal(goals.length, 2);
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { AnimComponentLayer, AnimController, AnimEvaluator, AnimTrack, EventHandler, Vec3 } from "playcanvas";
import { BellBugModel } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugModel.js";
import { BELL_BUG_ANIMATION } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugAnimation.js";
import { BellBugCalibration } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugCalibration.js";

it("matches tripod steps to travel speed and preserves action and inspection playback", () => {
  const app = new EventHandler();
  const model = {
    setLocalScale: () => {},
    setLocalPosition: () => {},
    setLocalEulerAngles: () => {},
    addComponent: () => {},
    destroy: () => {},
    anim: {
      speed: 1,
      addAnimationState: () => {},
      baseLayer: { transition: () => {} },
    },
  };
  const owner = {
    app,
    doorScratch: { attach: () => {} },
    clip: "scuttle_walk",
    stateName: "BellBugPursueState",
    entity: {
      addChild: () => {},
      rigidbody: { linearVelocity: new Vec3(0, 0, -(0.16 * BellBugCalibration.scale / (14 / 30 * 0.62))) },
    },
    modelLibrary: {
      instantiate: () => model,
      getAnimationTracks: () => new Map(),
    },
  };
  const playback = new BellBugModel(owner, "fixture.glb");
  app.fire("update");
  assert.equal(model.anim.speed, 1);
  owner.entity.rigidbody.linearVelocity.mulScalar(2);
  app.fire("update");
  assert.equal(model.anim.speed, 2);
  owner.entity.rigidbody.linearVelocity.set(0, 0, 0);
  app.fire("update");
  assert.equal(model.anim.speed, 0, "planted feet stop when travel stops");
  playback.play("scratch_attack");
  app.fire("update");
  assert.equal(model.anim.speed, 1, "stationary actions must still animate");
  playback.play("scuttle_walk");
  owner.stateName = "BellBugPlaybackState";
  app.fire("update");
  assert.equal(model.anim.speed, 1, "inspection plays the gait without moving the actor");
  playback.destroy();
  model.anim.speed = 2;
  app.fire("update");
  assert.equal(model.anim.speed, 2, "destroy removes the locomotion update listener");
});

it("restarts inspection clips during a real Engine crossfade without losing previous clips", () => {
  const app = new EventHandler();
  const evaluator = new AnimEvaluator({
    update: () => {},
    rebind: () => {},
  });
  const controller = new AnimController(evaluator, [{ name: "START" }], [], true, app);
  const anim = {
    speed: 1,
    addAnimationState: (name, track, speed, loop) => controller.assignAnimation(name, track, speed, loop),
    update: delta => controller.update(delta),
  };
  anim.baseLayer = new AnimComponentLayer("base", controller, anim);
  const model = {
    setLocalScale: () => {},
    anim,
    setLocalPosition: () => {},
    setLocalEulerAngles: () => {},
    addComponent: () => {},
    destroy: () => {},
  };
  const names = Object.values(BELL_BUG_ANIMATION);
  const tracks = new Map(names.map(name => [name, new AnimTrack(name, 1, [], [], [])]));
  const owner = {
    app,
    doorScratch: { attach: () => {} },
    clip: names[0],
    stateName: "BellBugPlaybackState",
    entity: { addChild: () => {} },
    modelLibrary: {
      instantiate: () => model,
      getAnimationTracks: () => tracks,
    },
  };
  const playback = new BellBugModel(owner, "fixture.glb");
  for (const name of [...names, names[0], "scuttle_walk"]) {
    playback.play(name);
    playback.restart(name);
    anim.update(0.02);
    assert.equal(anim.baseLayer.activeState, name);
    assert.ok(Number.isFinite(anim.baseLayer.activeStateCurrentTime));
  }
  playback.destroy();
});

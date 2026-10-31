import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { LatchHeroGaze } from "../../../../../../src/game/objects/enemies/latch-slug/LatchHeroGaze.js";

function fixture() {
  const app = new pc.EventHandler();
  const entity = new pc.Entity("slug"), model = new pc.Entity("model"), head = new pc.Entity("head");
  entity.addChild(model);
  model.addChild(head);
  for (const name of ["antenna_L", "antenna_R"]) {
    head.addChild(new pc.Entity(name));
  }
  const hero = {
    entity: new pc.Entity("hero"),
    height: 1.2,
  };
  hero.entity.setPosition(2, 0, 0);
  let obstruction = null;
  app.systems = {
    rigidbody: {
      raycastFirst: (start, end, options) => {
        assert.equal(options.filterCallback(entity), false);
        assert.equal(options.filterCallback(hero.entity), false);

        return obstruction;
      },
    },
  };
  const owner = {
    pc,
    app,
    entity,
    alive: true,
    airborne: false,
    carrier: null,
    statuses: new Map(),
    gatewayArrival: { active: false },
    runtime: { getHero: () => hero },
    stateName: "LatchDogState",
    get position() {
      return entity.getPosition();
    },
  };
  const gaze = new LatchHeroGaze(owner, model);

  return {
    owner,
    hero,
    gaze,
    head,
    app,
    block: (value) => {
      obstruction = value;
    },
  };
}

test("notices a visible hero within three tiles, follows both sides and releases distant attention", () => {
  const { gaze, hero } = fixture();
  gaze.update(0.2);
  assert.equal(gaze.isTracking, true);
  assert.ok(gaze.yaw < -20);
  hero.entity.setPosition(-2, 0, 0);
  gaze.update(0.5);
  assert.ok(gaze.yaw > 20);
  hero.entity.setPosition(3.01, 0, 0);
  gaze.update(0.2);
  assert.equal(gaze.isTracking, false);
  assert.equal(gaze.reason, "out of range");
  gaze.destroy();
});

test("walls and corners block attention, and action states take priority", () => {
  const { gaze, owner, block } = fixture();
  block({ entity: new pc.Entity("wall") });
  gaze.update(0.2);
  assert.equal(gaze.isTracking, false);
  assert.equal(gaze.reason, "blocked");
  block(null);
  gaze.update(0.2);
  assert.equal(gaze.isTracking, true);
  for (const state of ["LatchPressState", "LatchLeapState"]) {
    owner.stateName = state;
    gaze.update(0.2);
    assert.equal(gaze.isTracking, false);
  }
  owner.stateName = "LatchDogState";
  owner.airborne = true;
  gaze.update(0.2);
  assert.equal(gaze.reason, "busy");
  gaze.destroy();
});

test("additive eye poses restore exactly and never drift when authored animation is paused", () => {
  const { gaze, head, owner, app } = fixture();
  head.setLocalEulerAngles(3, 4, 5);
  const base = head.getLocalRotation().clone();
  const root = owner.entity.getRotation().clone();
  gaze.update(0.5);
  for (let i = 0; i < 100; i++) {
    app.fire("prerender");
    assert.notDeepEqual(head.getLocalRotation(), base);
    app.fire("postrender");
    assert.deepEqual(head.getLocalRotation(), base);
  }
  assert.deepEqual(owner.entity.getRotation(), root);
  app.fire("prerender");
  gaze.destroy();
  assert.deepEqual(head.getLocalRotation(), base);
  app.fire("prerender");
  assert.deepEqual(head.getLocalRotation(), base);
});
test("eye stalk length eases with target distance and restores the authored scale without drift", () => {
  const { gaze, hero, app } = fixture();
  const eye = gaze.eyes[0];
  eye.setLocalScale(0.9, 1.1, 1.2);
  const base = eye.getLocalScale().clone();
  hero.entity.setPosition(0.7, 0, 0);
  gaze.update(1);
  app.fire("prerender");
  const near = eye.getLocalScale().clone();
  app.fire("postrender");
  assert.deepEqual(eye.getLocalScale(), base);
  hero.entity.setPosition(3, 0, 0);
  gaze.update(1);
  for (let i = 0; i < 100; i++) {
    app.fire("prerender");
    assert.ok(eye.getLocalScale().y > near.y * 1.4);
    assert.equal(eye.getLocalScale().x, base.x);
    assert.equal(eye.getLocalScale().z, base.z);
    app.fire("postrender");
    assert.deepEqual(eye.getLocalScale(), base);
  }
  gaze.destroy();
  assert.deepEqual(eye.getLocalScale(), base);
});

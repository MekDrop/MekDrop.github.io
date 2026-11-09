import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { HeroCameraFollow } from "../../../../src/game/camera/HeroCameraFollow.js";
import { GameCamera } from "../../../../src/game/camera/GameCamera.js";

function fixture() {
  const calls = [];
  const camera = {
    panX: 2,
    panZ: 4,
    rotation: 0,
    zoom: 1,
    baseOrthoHeight: 24,
    manuallyMoved: false,
    returnTransition: null,
    camera: { worldToScreen: () => new pc.Vec3(320, 240, 0) },
    screenDeltaToGround: GameCamera.prototype.screenDeltaToGround,
  };
  const hero = { entity: { getPosition: () => new pc.Vec3(10, 0, 20) } };
  const follow = new HeroCameraFollow({
    pc,
    camera,
    canvas: {
      clientWidth: 640,
      clientHeight: 480,
    },
    container: { clientHeight: 480 },
    pitch: Math.atan(1 / Math.sqrt(2)),
    updateCamera: (...args) => calls.push(["update", ...args]),
    scheduleVisibility: () => calls.push(["visibility"]),
  });

  return {
    follow,
    hero,
    camera,
    calls,
  };
}

it("does not follow or schedule visibility for a dying hero or locked camera", () => {
  const f = fixture();
  f.hero.isDying = true;
  f.follow.follow(f.hero, false);
  f.hero.isDying = false;
  f.follow.follow(f.hero, true);
  assert.deepEqual(f.calls, []);
});

it("preserves manual pan and follows a zoomed hero only in automatic mode", () => {
  const f = fixture();
  f.camera.zoom = 2;
  f.camera.manuallyMoved = true;
  f.follow.follow(f.hero, false);
  assert.equal(f.camera.panX, 2);
  assert.deepEqual(f.calls, [["visibility"]]);
  f.calls.length = 0;
  f.camera.manuallyMoved = false;
  f.follow.follow(f.hero, false);
  assert.equal(f.camera.panX, 10);
  assert.equal(f.camera.panZ, 20);
  assert.deepEqual(f.calls, [["update"], ["visibility"]]);
});

it("corrects an out-of-bounds hero at fit zoom and leaves an in-bounds hero alone", () => {
  const f = fixture();
  f.follow.follow(f.hero, false);
  assert.deepEqual(f.calls, [["visibility"]]);
  f.calls.length = 0;
  f.camera.camera.worldToScreen = () => new pc.Vec3(650, -10, 0);
  const correction = f.camera.screenDeltaToGround(42, -42, 1, 480, Math.atan(1 / Math.sqrt(2)));
  f.follow.follow(f.hero, false);
  assert.equal(f.camera.panX, 2 + correction.x);
  assert.equal(f.camera.panZ, 4 + correction.z);
  assert.deepEqual(f.calls, [["update"], ["visibility"]]);
});

it("returns smoothly toward the current hero and resumes automatic follow only at completion", () => {
  const f = fixture();
  f.camera.manuallyMoved = true;
  assert.equal(f.follow.startReturn(f.hero, false), false);
  assert.equal(f.follow.startReturn(f.hero, false, true), true);
  const transition = f.camera.returnTransition;
  assert.equal(f.follow.startReturn(f.hero, false, true), true);
  assert.equal(f.camera.returnTransition, transition);
  f.follow.update(-1, f.hero, false);
  assert.equal(transition.elapsed, 0);
  f.follow.update(0.225, f.hero, false);
  assert.equal(f.camera.panX, 6);
  assert.equal(f.camera.panZ, 12);
  assert.equal(f.camera.manuallyMoved, true);
  f.hero.entity.getPosition = () => new pc.Vec3(20, 0, 30);
  f.follow.update(0.225, f.hero, false);
  assert.equal(f.camera.panX, 20);
  assert.equal(f.camera.panZ, 30);
  assert.equal(f.camera.returnTransition, null);
  assert.equal(f.camera.manuallyMoved, false);
});

it("keeps respawn return focus and suspends transitions while locked or missing a hero", () => {
  const f = fixture();
  f.hero.isRespawning = true;
  f.camera.camera.worldToScreen = () => new pc.Vec3(-20, 240, 0);
  f.follow.follow(f.hero, false);
  assert.equal(f.camera.returnTransition.duration, 0.32);
  assert.equal(f.camera.returnTransition.preserveFocus, true);
  f.calls.length = 0;
  f.follow.update(0.1, f.hero, true);
  f.follow.update(0.1, null, false);
  assert.deepEqual(f.calls, []);
  assert.equal(f.camera.returnTransition.elapsed, 0);
  f.follow.update(0.16, f.hero, false);
  assert.deepEqual(f.calls, [["update", null, true], ["visibility"]]);
});

it("refreshes first-person attachment without changing isometric pan", () => {
  const f = fixture();
  f.camera.firstPersonEnabled = true;
  f.follow.follow(f.hero, false);
  assert.equal(f.camera.panX, 2);
  assert.deepEqual(f.calls, [["update"]]);
});

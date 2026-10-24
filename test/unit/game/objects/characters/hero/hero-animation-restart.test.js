import assert from "node:assert/strict";
import { it } from "node:test";
import { AnimController } from "../../../../../../node_modules/playcanvas/build/playcanvas/src/framework/anim/controller/anim-controller.js";
import { AnimTransition } from "../../../../../../node_modules/playcanvas/build/playcanvas/src/framework/anim/controller/anim-transition.js";
import { AnimTrack } from "../../../../../../node_modules/playcanvas/build/playcanvas/src/framework/anim/evaluator/anim-track.js";
import { HERO_ANIMATION } from "../../../../../../src/game/enum/HeroAnimation.js";

import { HeroAnimationPlayback } from "../../../../../../src/game/objects/characters/hero/HeroAnimationPlayback.js";

it("restarts during an interrupted blend and safely transitions again", () => {
  const evaluator = {
    clips: [],
    findClip(name) {
      return this.clips.find((clip) => clip.name === name) ?? null;
    },
    addClip(clip) {
      this.clips.push(clip);
    },
    removeClips() {
      this.clips = [];
    },
    updateClipTrack: () => {},
  };
  const names = ["START", "idle", "walk", "jump"];
  const controller = new AnimController(evaluator, names.map((name) => ({
    name,
    speed: 1,
    loop: true,
  })), [], false);
  for (const name of names.slice(1)) {
    controller.assignAnimation(name, new AnimTrack(name, 1, [], [], []));
  }
  const animation = {
    addAnimationState: () => {},
    baseLayer: {
      reset: () => controller.reset(),
      play: (name) => controller.play(name),
      transition: (name, time) => controller.updateStateFromTransition(new AnimTransition({
        from: controller.activeStateName,
        to: name,
        time,
      })),
    },
  };
  const playback = new HeroAnimationPlayback();
  playback.initialize({
    addComponent: () => {},
    anim: animation,
  }, {
    getAnimationTracks: () => new Map(Object.values(HERO_ANIMATION)
      .map(name => [name, { duration: 1 }])),
  }, "hero.glb");
  playback.play("idle", 1, true);
  playback.play("walk", 1, false);
  playback.play("jump", 1, false);
  playback.play("idle", 1, true);
  assert.doesNotThrow(() => playback.play("walk", 1.5, false));
  assert.equal(controller.activeStateName, "walk");
  assert.equal(animation.speed, 1.5);
  assert.ok(evaluator.findClip("walk"));
});

it("registers supported clips, preserves ladder playback, and releases references", () => {
  const calls = [];
  const tracks = new Map([
    [HERO_ANIMATION.IDLE, { duration: 1 }],
    [HERO_ANIMATION.CLIMB_TOP, { duration: 1 }],
    [HERO_ANIMATION.CHOP_LOW, { duration: 1 }],
    [HERO_ANIMATION.CHOP_MIDDLE, { duration: 1 }],
    [HERO_ANIMATION.CHOP_HIGH, { duration: 1 }],
    [HERO_ANIMATION.DIG, { duration: 1 }],
    [HERO_ANIMATION.FILL_HOLE, { duration: 1 }],
    ["unused", {}],
  ]);
  const animation = {
    addAnimationState: (...args) => calls.push(args),
    baseLayer: {
      play: (name) => calls.push(["play", name]),
      transition: (name, duration) => calls.push(["transition", name, duration]),
    },
  };
  const playback = new HeroAnimationPlayback();
  playback.play(HERO_ANIMATION.WALK, 1, false);
  assert.equal(playback.state, null);
  assert.equal(playback.initialize({
    addComponent: (type, options) => calls.push([type, options]),
    anim: animation,
  }, { getAnimationTracks: () => tracks }, "hero.glb"), tracks);
  assert.deepEqual(calls[0], ["anim", { activate: true }]);
  assert.deepEqual(calls[1], [HERO_ANIMATION.IDLE, tracks.get(HERO_ANIMATION.IDLE), 1, true]);
  assert.deepEqual(calls[2], [HERO_ANIMATION.CLIMB_TOP, tracks.get(HERO_ANIMATION.CLIMB_TOP), 1, false]);
  assert.equal(calls.some(call => call[0] === "unused"), false);
  assert.deepEqual(calls.at(-1), ["play", HERO_ANIMATION.IDLE]);
  playback.play(HERO_ANIMATION.WALK, 1.2, false);
  assert.deepEqual(calls.at(-1), ["transition", HERO_ANIMATION.WALK, 0.14]);
  const count = calls.length;
  playback.play(HERO_ANIMATION.WALK, 0.8, false);
  assert.equal(calls.length, count);
  assert.equal(animation.speed, 0.8);
  playback.play(HERO_ANIMATION.CLIMB_TOP, 0, false);
  assert.equal(animation.baseLayer.playing, false);
  assert.deepEqual(calls.at(-1), ["transition", HERO_ANIMATION.CLIMB_TOP, 0]);
  playback.play(HERO_ANIMATION.IDLE, 1, false);
  assert.equal(animation.baseLayer.playing, true);
  assert.deepEqual(calls.at(-1), ["transition", HERO_ANIMATION.IDLE, 0]);
  playback.destroy();
  assert.equal(playback.state, null);
  const before = calls.length;
  playback.play(HERO_ANIMATION.WALK, 1, true);
  assert.equal(calls.length, before);
});

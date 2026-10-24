import assert from "node:assert/strict";
import { it } from "node:test";
import { HERO_ANIMATION } from "../../../../../../src/game/enum/HeroAnimation.js";
import { HeroAnimationPlayback } from "../../../../../../src/game/objects/characters/hero/HeroAnimationPlayback.js";

it("blends cutting level and approach changes even when the next clip restarts", () => {
  const transitions = [];
  const animation = {
    addAnimationState: () => {},
    baseLayer: {
      play: () => {},
      transition: (...args) => transitions.push(args),
    },
  };
  const playback = new HeroAnimationPlayback();
  const tracks = new Map(Object.values(HERO_ANIMATION).map(name => [name, { duration: 1.5 }]));
  playback.initialize({
    anim: animation,
    addComponent: () => {},
  },
  { getAnimationTracks: () => tracks }, "hero.glb");
  for (const name of [HERO_ANIMATION.SUMMON_AXE, HERO_ANIMATION.CHOP_ROW_7,
    HERO_ANIMATION.CHOP_HIGH, HERO_ANIMATION.WALK, HERO_ANIMATION.SUMMON_AXE,
    HERO_ANIMATION.CHOP_ROW_5, HERO_ANIMATION.DISMISS_AXE, HERO_ANIMATION.IDLE]) {
    playback.play(name, 1, true);
    assert.deepEqual(transitions.at(-1), [name, 0.32]);
  }
  playback.play(HERO_ANIMATION.CHOP_LOW, 1, true);
  playback.play(HERO_ANIMATION.CHOP_LOW, 1, true);
  assert.deepEqual(transitions.at(-1), [HERO_ANIMATION.CHOP_LOW, 0]);
  playback.play(HERO_ANIMATION.DODGE_LEFT, 1, true);
  assert.deepEqual(transitions.at(-1), [HERO_ANIMATION.DODGE_LEFT, 0]);
});

it("fits an action clip to its physics duration and restores normal locomotion speed", () => {
  const animation = {
    speed: 1,
    addAnimationState: () => {},
    baseLayer: {
      play: () => {},
      transition: () => {},
    },
  };
  const playback = new HeroAnimationPlayback();
  const tracks = new Map(Object.values(HERO_ANIMATION).map(name => [name, { duration: 0.583333 }]));
  playback.initialize({
    anim: animation,
    addComponent: () => {},
  }, {
    getAnimationTracks: () => tracks,
  }, "hero.glb");
  playback.play(HERO_ANIMATION.DODGE_LEFT, 1, true, 0.497);
  assert.ok(Math.abs(animation.speed * 0.497 - 0.583333) < 0.000001);
  playback.play(HERO_ANIMATION.WALK, 1.4, false);
  assert.equal(animation.speed, 1.4);
  playback.destroy();
});

it("keeps the supporting-leg phase when blending between walking and running", () => {
  const transitions = [];
  const animation = {
    speed: 1,
    addAnimationState: () => {},
    baseLayer: {
      activeStateCurrentTime: 0.25,
      play: () => {},
      transition: (...args) => transitions.push(args),
    },
  };
  const playback = new HeroAnimationPlayback();
  const tracks = new Map(Object.values(HERO_ANIMATION).map(name => [name, { duration: 1 }]));
  playback.initialize({
    anim: animation,
    addComponent: () => {},
  }, { getAnimationTracks: () => tracks }, "hero.glb");
  playback.play(HERO_ANIMATION.WALK, 1, false);
  playback.play(HERO_ANIMATION.RUN, 1, false);
  assert.deepEqual(transitions.at(-1), [HERO_ANIMATION.RUN, 0.22, 0.25]);
  playback.play(HERO_ANIMATION.WALK, 1, false);
  assert.deepEqual(transitions.at(-1), [HERO_ANIMATION.WALK, 0.22, 0.25]);
});

it("pauses an active action through freeze and restores its authored playback speed", () => {
  const animation = {
    speed: 1,
    addAnimationState: () => {},
    baseLayer: {
      play: () => {},
      transition: () => {},
    },
  };
  const playback = new HeroAnimationPlayback();
  const tracks = new Map(Object.values(HERO_ANIMATION).map(name => [name, { duration: 1 }]));
  playback.initialize({
    anim: animation,
    addComponent: () => {},
  }, {
    getAnimationTracks: () => tracks,
  }, "hero.glb");
  playback.play(HERO_ANIMATION.DODGE_LEFT, 1, true, 0.5);
  assert.equal(animation.speed, 2);
  playback.rate = 0;
  assert.equal(animation.speed, 0);
  playback.play(HERO_ANIMATION.DODGE_LEFT, 1, false, 0.5);
  assert.equal(animation.speed, 0);
  playback.rate = 0.45;
  assert.equal(animation.speed, 0.9);
  playback.rate = 1;
  assert.equal(animation.speed, 2);
});

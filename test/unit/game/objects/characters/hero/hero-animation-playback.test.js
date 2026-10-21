import assert from "node:assert/strict";
import { it } from "node:test";
import { HERO_ANIMATION } from "../../../../../../src/game/enum/HeroAnimation.js";
import { HeroAnimationPlayback } from "../../../../../../src/game/objects/characters/hero/HeroAnimationPlayback.js";

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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { AnimController } from "../../../../../node_modules/playcanvas/build/playcanvas/src/framework/anim/controller/anim-controller.js";
import { AnimTransition } from "../../../../../node_modules/playcanvas/build/playcanvas/src/framework/anim/controller/anim-transition.js";
import { AnimTrack } from "../../../../../node_modules/playcanvas/build/playcanvas/src/framework/anim/evaluator/anim-track.js";
import { HERO_ANIMATION } from "../../../../../src/game/enum/HeroAnimation.js";

const source = readFileSync(new URL("../../../../../src/game/objects/hero/Hero.js", import.meta.url), "utf8");
const method = source.slice(source.indexOf("  #playAnimation("), source.indexOf("  get #headLookTargetYaw"));
const Playback = new Function("LADDER_TOP_ANIMATIONS", `
  const ANIMATION_BLEND_TIME = 0.2;
  return class {
    #modelRoot;
    #animationState;
    constructor(anim) { this.#modelRoot = { anim }; }
    play(...args) { this.#playAnimation(...args); }
    ${method}
  };
`)(new Set([HERO_ANIMATION.CLIMB_TOP, HERO_ANIMATION.CLIMB_TOP_RIGHT]));

it("restarts during an interrupted blend and safely transitions again", () => {
  const evaluator = {
    clips: [],
    findClip(name) { return this.clips.find((clip) => clip.name === name) ?? null; },
    addClip(clip) { this.clips.push(clip); },
    removeClips() { this.clips = []; },
    updateClipTrack() {},
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
  const playback = new Playback(animation);
  playback.play("idle", 1, true);
  playback.play("walk", 1, false);
  playback.play("jump", 1, false);
  playback.play("idle", 1, true);
  assert.doesNotThrow(() => playback.play("walk", 1.5, false));
  assert.equal(controller.activeStateName, "walk");
  assert.equal(animation.speed, 1.5);
  assert.ok(evaluator.findClip("walk"));
});

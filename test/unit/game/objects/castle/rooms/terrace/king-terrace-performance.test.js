import assert from "node:assert/strict";
import { it } from "node:test";
import { KING_ANIMATION } from "../../../../../../../src/game/enum/KingAnimation.js";
import { KingTerracePerformance } from "../../../../../../../src/game/objects/castle/rooms/terrace/KingTerracePerformance.js";

it("selects model-authored idle and walk clips", () => {
  const performance = new KingTerracePerformance(0.5);
  assert.equal(performance.sample("idle", 3).clip, KING_ANIMATION.TERRACE_IDLE);
  assert.equal(performance.sample("walk", 3).clip, KING_ANIMATION.TERRACE_WALK);
  assert.equal(performance.sample("sword", 0, 0.5).clip, KING_ANIMATION.SWORD_READY);
  assert.equal(performance.sample("sword", 3, 0.5).clip, KING_ANIMATION.SWORD_FINISH);
});

it("plays the selected authored exercise without manufactured travel", () => {
  const performance = new KingTerracePerformance({ random: () => 0 });
  for (const time of [0, 1.5, 3.6, 6.2, 12.4]) {
    const sample = performance.sample("sword", time);
    assert.equal(sample.clip, KING_ANIMATION.SWORD_COMBINATION);
    assert.deepEqual(sample.offset, {
      x:0,
      y:0,
      z:0,
    });
    assert.equal(sample.yaw, 0);
    assert.equal(sample.failed, false);
  }
});
import { readFileSync } from "node:fs";
import * as pc from "playcanvas";

it("keeps resident sword movement in the terrace frame and resumes clips after sitting", () => {
  const source = readFileSync(new URL("../../../../../../../src/game/objects/castle/rooms/terrace/TerraceKing.js", import.meta.url), "utf8")
    .replace(/^import[^\n]+\r?\n/gm, "");
  const layer = {
    activeState: null,
    play(name) {
      this.activeState = name;
      this.activeStateCurrentTime = 0;
    },
    transition(name) {
      this.play(name);
    },
  };
  const entity = new pc.Entity();
  const model = new pc.Entity();
  model.addComponent = () => {
    model.anim = {
      speed: 1,
      baseLayer: layer,
      addAnimationState: () => {},
    };
  };
  const played = [];
  let audioClips;
  const King = new Function("kingModelUrl", "KING_ANIMATION", "KingTerracePerformance", "TerraceActor", "GameObjectAudio", "CastleAudio", "KingTrainingExpression", "KingTrainingClips",
    `${source.replace("export class", "class")}\nreturn TerraceKing;`)("king", KING_ANIMATION, class extends KingTerracePerformance {
    constructor() {
      super({ random: () => 0 });
    }
  },
  class {
    entity = entity; model = model;
  }, class {
    constructor(_entity, _app, _library, clips) {
      audioClips = clips;
    }
    follow() {}
    play(name) {
      played.push(name);
    }
  }, {
    stoneStep1: "stone1",
    stoneStep2: "stone2",
  }, class {
    pose() {}
  }, KingTrainingClips);
  const actor = new King({
    pc,
    modelLibrary: { getAnimationTracks: () => new Map(Object.values(KING_ANIMATION).map((name) => [name, { duration: 1 }])) },
    performanceSeed: 0.271828,
    app: {},
    runtime: { audioLibrary: {} },
  });
  const scene = new pc.Entity(); scene.addChild(entity);
  const stage = new pc.Entity(); scene.addChild(stage);
  stage.setLocalScale(0.45, 0.45, 0.45); stage.setLocalEulerAngles(0, 90, 0);
  actor.performanceFrame = stage;
  const origin = new pc.Vec3(10, 6, 12);
  entity.setPosition(origin);
  actor.pose("sword", 4, 1);
  const sample = new KingTerracePerformance(0.271828).sample("sword", 4, 1);
  const expected = stage.getWorldTransform().transformVector(new pc.Vec3(sample.offset.x, sample.offset.y, sample.offset.z)).add(origin);
  assert.ok(entity.getPosition().distance(expected) < 0.00001);
  assert.deepEqual(Object.keys(audioClips), ["stoneStep1", "stoneStep2"]);
  for (const time of [0, 1.4, 1.54]) {
    layer.activeStateCurrentTime = time;
    actor.pose("sword", time, 1);
  }
  assert.deepEqual(played, [], "air strokes stay silent");
  for (const time of [1.55, 1.56, 3.33, 5.15, 5.16]) {
    layer.activeStateCurrentTime = time; actor.pose("sword", time, 1);
  }
  assert.deepEqual(played, ["stoneStep1", "stoneStep2"], "one stone step per foot landing");
  actor.pose("walk");
  layer.play("WalkOut");
  actor.pose("walk");
  assert.equal(layer.activeState, KING_ANIMATION.TERRACE_WALK);
  actor.stamina = 0;
  layer.activeStateCurrentTime = 6.1;
  actor.pose("sword", 30);
  assert.equal(model.anim.speed, 0.45);
  layer.activeStateCurrentTime = 149 / 24;
  actor.pose("sword", 30.1);
  assert.equal(layer.activeState, KING_ANIMATION.GROUND_SIT_DOWN);
  layer.activeStateCurrentTime = 1.5;
  actor.pose("sword", 31.6);
  assert.equal(layer.activeState, KING_ANIMATION.GROUND_REST);
  assert.equal(actor.resting, true);
  const beforeRest = played.length;
  for (let frame = 1; frame <= 141; frame++) {
    if (layer.activeState !== KING_ANIMATION.GROUND_REST) {
      break;
    }
    layer.activeStateCurrentTime = (frame / 10) % 2.5;
    actor.pose("sword", 31.6 + frame / 10);
  }
  assert.equal(played.length, beforeRest, "seated recovery emits no repeated footsteps");
  assert.equal(actor.stamina, 1);
  assert.equal(layer.activeState, KING_ANIMATION.GROUND_STAND_UP);
  layer.activeStateCurrentTime = 1.5;
  actor.pose("sword", 47.2);
  assert.equal(layer.activeState, KING_ANIMATION.ADVANCE_RETREAT);
  assert.equal(actor.resting, false);
  assert.equal(model.anim.speed, 1);
});

import { KingTrainingClips } from "../../../../../../../src/game/objects/castle/rooms/terrace/KingTrainingClips.js";

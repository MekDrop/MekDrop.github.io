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

it("covers every sword pose while adding seeded repeats and failures", () => {
  const performance = new KingTerracePerformance(0.271828);
  const clips = new Set();
  let repeats = 0;
  let failures = 0;
  let previousClip = null;
  for (let step = 0; step < 30; step += 1) {
    const sample = performance.sample("sword", step * 0.65, 1);
    clips.add(sample.clip);
    repeats += Number(sample.repeated);
    failures += Number(sample.failed);
    assert.equal(sample.sequenceStep, step);
    if (sample.repeated) {
      assert.equal(sample.clip, previousClip);
    }
    previousClip = sample.clip;
  }
  for (const clip of Object.values(KING_ANIMATION).filter((name) =>
    name.startsWith("Sword") && !name.startsWith("SwordFailure"))) {
    assert.ok(clips.has(clip), `missing ${clip}`);
  }
  assert.ok(repeats >= 1);
  assert.ok(failures >= 1);
});

it("moves the king around the roof while returning to his starting position", () => {
  const performance = new KingTerracePerformance(0.271828);
  const offsets = [];
  const yaws = [];
  for (let step = 0; step < 30; step += 1) {
    const sample = performance.sample("sword", step * 0.65 + 0.3, 1);
    offsets.push(sample.offset);
    yaws.push(sample.yaw);
  }
  const xValues = offsets.map(({ x }) => x);
  const zValues = offsets.map(({ z }) => z);
  assert.ok(Math.max(...xValues) - Math.min(...xValues) > 2);
  assert.ok(Math.max(...zValues) > 0.5);
  assert.ok(Math.max(...yaws) - Math.min(...yaws) > 80);
  assert.deepEqual(performance.sample("sword", 0, 0.5).offset,
    {
      x: 0,
      y: 0,
      z: 0,
    });
  assert.deepEqual(performance.sample("sword", 3, 0.5).offset,
    {
      x: 0,
      y: 0,
      z: 0,
    });
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
  const King = new Function("kingModelUrl", "KING_ANIMATION", "KingTerracePerformance", "TerraceActor",
    `${source.replace("export class", "class")}\nreturn TerraceKing;`)("king", KING_ANIMATION, KingTerracePerformance,
    class {
      entity = entity; model = model;
    });
  const actor = new King({
    pc,
    modelLibrary: { getAnimationTracks: () => new Map(Object.values(KING_ANIMATION).map((name) => [name, { duration: 1 }])) },
    performanceSeed: 0.271828,
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
  actor.pose("walk");
  layer.play("WalkOut");
  actor.pose("walk");
  assert.equal(layer.activeState, KING_ANIMATION.TERRACE_WALK);
});

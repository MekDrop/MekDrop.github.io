import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Quat, Vec3 } from "playcanvas";

/**
 * @param {string} path
 */
function asset(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  const start = 28 + length;
  /**
   * @param {number} index
   */
  const samples = (index) => {
    const accessor = json.accessors[index];
    const view = json.bufferViews[accessor.bufferView];
    const size = {
      SCALAR: 1,
      VEC3: 3,
      VEC4: 4,
    }[accessor.type];

    return Array.from({ length: accessor.count }, (_, sample) =>
      Array.from({ length: size }, (_, component) => bytes.readFloatLE(
        start + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
        + sample * (view.byteStride ?? size * 4) + component * 4,
      )));
  };

  return {
    json,
    samples,
  };
}

const hero = asset("../../../../../src/game/models/hero/hero.glb");
const variant = asset("../../../../../src/game/models/hero/variants/special-artojas/special-artojas.glb");

/**
 * @param {string} clip
 * @param {number} time
 */
function pose(clip, time) {
  const entities = hero.json.nodes.map((node) => {
    const entity = new Entity(node.name);
    entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
    entity.setLocalRotation(new Quat(...(node.rotation ?? [0, 0, 0, 1])));
    entity.setLocalScale(...(node.scale ?? [1, 1, 1]));

    return entity;
  });
  hero.json.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      entities[index].addChild(entities[child]);
    }
  });
  const animation = hero.json.animations.find((animation) => animation.name === clip);
  for (const channel of animation.channels) {
    const path = channel.target.path;
    if (path === "weights") {
      continue;
    }
    const sampler = animation.samplers[channel.sampler];
    const times = hero.samples(sampler.input).flat();
    const values = hero.samples(sampler.output);
    let right = times.findIndex((value) => value >= time);
    if (right < 0) {
      right = times.length - 1;
    }
    const left = Math.max(0, right - 1);
    const amount = left === right ? 0 : Math.max(0, Math.min(1,
      (time - times[left]) / (times[right] - times[left])));
    const entity = entities[channel.target.node];
    if (path === "rotation") {
      entity.setLocalRotation(new Quat().slerp(
        new Quat(...values[left]), new Quat(...values[right]), amount,
      ));
    } else {
      const value = new Vec3().lerp(new Vec3(...values[left]), new Vec3(...values[right]), amount);
      if (path === "translation") {
        entity.setLocalPosition(value);
      } else {
        entity.setLocalScale(value);
      }
    }
  }

  return new Map(entities.map((entity) => [entity.name, entity]));
}

it("exports complete dedicated hammer clips on both playable hero models", () => {
  for (const model of [hero, variant]) {
    for (const [name, duration] of [["SummonHammer", 0.57], ["SmashBridge", 1.8], ["DismissHammer", 0.57]]) {
      const clip = model.json.animations.find((clip) => clip.name === name);
      assert.ok(clip, name);
      const end = Math.max(...clip.samplers.map((sampler) => model.samples(sampler.input).at(-1)[0]));
      assert.ok(Math.abs(end - duration) < 0.02, `${name} duration ${end}`);
      const hand = model.json.nodes.find((node) => node.name === "Right white glove");
      assert.ok(hand.children.some((index) => model.json.nodes[index].name === "Hammer grip"));
    }
  }
});

it("raises the heavy head above the hero and brings it down onto the adjacent deck at impact", () => {
  /**
   * @param {number} time
   */
  const headAt = (time) => pose("SmashBridge", time).get("Hammer grip")
    .getWorldTransform().transformPoint(new Vec3(0, 1.7, 0));
  const raised = headAt(0.67);
  const impact = headAt(0.94);
  assert.ok(raised.y > 3, `windup height ${raised.y}`);
  assert.ok(impact.y > 0 && impact.y < 0.2, `contact height ${impact.y}`);
  assert.ok(impact.z > 1.85 && impact.z < 2.1, `adjacent section reach ${impact.z}`);
  assert.ok(headAt(0.79).y - impact.y > 2.5, "distinct fast downswing");
});

it("keeps both palms on separate shaft grips throughout the complete stroke", () => {
  for (let frame = 0; frame <= 108; frame++) {
    const nodes = pose("SmashBridge", frame / 60);
    const shaft = nodes.get("Hammer grip").getWorldTransform();
    for (const [side, along] of [["Right", 0], ["Left", 0.15]]) {
      const hand = nodes.get(`${side} white glove`).getWorldTransform();
      const palm = hand.transformPoint(new Vec3(0, -0.08, 0.095));
      const grip = shaft.transformPoint(new Vec3(0, along, 0));
      assert.ok(palm.distance(grip) < 0.004, `${side} palm leaves shaft at ${frame / 60}`);
    }
  }
});

it("keeps the planted boot assemblies and knee contacts rigid while swinging", () => {
  const reference = pose("SmashBridge", 0);
  for (let frame = 0; frame <= 54; frame++) {
    const nodes = pose("SmashBridge", frame / 30);
    for (const [side, suffix] of [["Left", ""], ["Right", ".001"]]) {
      const foot = `Boot foot${suffix}`;
      const inverse = nodes.get(foot).getWorldTransform().clone().invert();
      const beforeInverse = reference.get(foot).getWorldTransform().clone().invert();
      for (const part of [`Boot cuff${suffix}`, `Boot sole${suffix}`, `Boot toe${suffix}`]) {
        const relative = inverse.clone().mul(nodes.get(part).getWorldTransform());
        const before = beforeInverse.clone().mul(reference.get(part).getWorldTransform());
        const difference = Math.max(...relative.data.map((value, index) => Math.abs(value - before.data[index])));
        assert.ok(difference < 0.0001, `${part} changes shape at ${frame / 30}`);
      }
      const knee = inverse.transformPoint(nodes.get(`${side} knee`).getPosition());
      const beforeKnee = beforeInverse.transformPoint(reference.get(`${side} knee`).getPosition());
      assert.ok(knee.distance(beforeKnee) < 0.0001, `${side} shin leaves boot at ${frame / 30}`);
    }
  }
});

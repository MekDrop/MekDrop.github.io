import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Quat, Vec3 } from "playcanvas";
import { HERO_PICKUP_ACTIONS } from "../../../../../src/game/config/hero-pickup-actions.js";

const buffer = readFileSync(new URL(
  "../../../../../src/game/models/hero/hero.glb",
  import.meta.url,
));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;

/**
 * @param {number} index
 */
function samples(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const count = accessor.type === "VEC4" ? 4 : accessor.type === "VEC3" ? 3 : 1;
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return Array.from({ length: accessor.count }, (_, sample) =>
    Array.from({ length: count }, (_, component) =>
      buffer.readFloatLE(start + sample * (view.byteStride ?? count * 4) + component * 4)));
}

/**
 * @param {string} name
 * @param {number} time
 */
function pose(name, time) {
  const nodes = gltf.nodes.map((node) => {
    const entity = new Entity(node.name);
    entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
    entity.setLocalRotation(new Quat(...(node.rotation ?? [0, 0, 0, 1])));
    entity.setLocalScale(...(node.scale ?? [1, 1, 1]));

    return entity;
  });
  gltf.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      nodes[index].addChild(nodes[child]);
    }
  });
  const animation = gltf.animations.find((animation) => animation.name === name);
  for (const channel of animation.channels) {
    if (channel.target.path === "weights") {
      continue;
    }
    const sampler = animation.samplers[channel.sampler];
    const times = samples(sampler.input).flat();
    const values = samples(sampler.output);
    let index = times.findIndex((sample) => sample >= time);
    if (index < 0) {
      index = times.length - 1;
    }
    const previous = Math.max(0, index - 1);
    const amount = index === previous ? 0
      : (time - times[previous]) / (times[index] - times[previous]);
    const entity = nodes[channel.target.node];
    if (channel.target.path === "rotation") {
      entity.setLocalRotation(new Quat().slerp(
        new Quat(...values[previous]),
        new Quat(...values[index]),
        amount,
      ));
    } else {
      const value = new Vec3().lerp(new Vec3(...values[previous]), new Vec3(...values[index]), amount);
      if (channel.target.path === "translation") {
        entity.setLocalPosition(value);
      } else {
        entity.setLocalScale(value);
      }
    }
  }

  return new Map(nodes.map((node) => [node.name, node]));
}

it("grasps the stem base while kneeling on the right knee and returns to Idle", () => {
  const action = HERO_PICKUP_ACTIONS.flower;
  const idle = pose("Idle", 0);
  const contact = pose(action.animation, action.impactTime);
  const hand = contact.get("Right white glove").getPosition().clone().mulScalar(0.65);
  assert.ok(hand.distance(new Vec3(0, 0.04, action.targetDistance)) < 0.01, `stem-base contact: ${hand}`);
  const knee = contact.get("Right knee").getPosition().clone().mulScalar(0.65);
  const leftKnee = contact.get("Left knee").getPosition().clone().mulScalar(0.65);
  assert.ok(knee.y < 0.12, `rear knee is too high: ${knee}`);
  assert.ok(leftKnee.y > knee.y + 0.1, "front knee must remain raised");
  assert.ok(contact.get("Right ankle").getPosition().z < -0.25, "rear boot must extend behind the kneeling knee");
  // Include times between exported frames to catch rotation interpolation flips.
  for (let frame = 0; frame <= 180; frame += 1) {
    const current = pose(action.animation, frame / 120);
    const clearance = Math.abs(current.get("Left ankle").getPosition().y - idle.get("Left ankle").getPosition().y) * 0.65;
    assert.ok(clearance < 0.005, `front foot lost support by ${clearance}m at frame ${frame}`);
  }
  for (const time of [0, action.duration]) {
    const current = pose(action.animation, time);
    for (const name of ["Upper body", "Right arm", "Right elbow", "Right white glove", "Left ankle", "Right ankle", "Left knee", "Right knee"]) {
      assert.ok(current.get(name).getPosition().distance(idle.get(name).getPosition()) < 0.001, `${name} did not return to Idle`);
    }
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Quat, Vec3 } from "playcanvas";
import { HERO_PICKUP_ACTIONS } from "../../../../../src/game/config/hero-pickup-actions.js";
import { HERO_MODEL_SCALE } from "../../../../../src/game/config/character-size.js";

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

it("cuts across the mushroom stem before the left hand lifts and stows it", () => {
  const action = HERO_PICKUP_ACTIONS.mushroom;
  const knifeBuffer = readFileSync(new URL(
    "../../../../../src/game/models/hero/tools/knife.glb", import.meta.url,
  ));
  const knife = JSON.parse(knifeBuffer.subarray(20, 20 + knifeBuffer.readUInt32LE(12)));
  const geometry = knife.nodes.find((node) => node.name === "Knife geometry");
  const grip = new Quat().setFromEulerAngles(90, 0, 0)
    .mul(new Quat().setFromEulerAngles(0, 0, -90))
    .mul(new Quat(...geometry.rotation).invert());
  const edgeInHand = grip.mul(new Quat(...geometry.rotation))
    .transformVector(new Vec3(0, -0.5, 0)).mulScalar(0.6)
    .add(new Vec3(0, -0.055, 0.06));
  const start = pose(action.animation, action.cutStartTime);
  const middle = pose(action.animation, (action.cutStartTime + action.impactTime) / 2);
  const cut = pose(action.animation, action.impactTime);
  const blade = middle.get("Right white glove").getWorldTransform().transformPoint(edgeInHand).mulScalar(HERO_MODEL_SCALE);
  assert.ok(blade.distance(new Vec3(0, 0.195 * HERO_MODEL_SCALE, action.targetDistance)) < 0.025, `knife missed stem: ${blade}`);
  const startHand = start.get("Right white glove").getPosition();
  const endHand = cut.get("Right white glove").getPosition();
  assert.ok((endHand.x - startHand.x) * HERO_MODEL_SCALE > 0.03, "knife must make a short lateral slice");
  assert.ok((endHand.x - startHand.x) * HERO_MODEL_SCALE < 0.05, "cut must not become a broad arm sweep");
  assert.ok(Math.abs(endHand.z - startHand.z) < 0.01, "slice must stay in the stem's plane");
  assert.ok(start.get("Left white glove").getPosition().distance(cut.get("Left white glove").getPosition()) < 0.01, "support hand must stay still until the cut finishes");
  const lifted = pose(action.animation, action.stowStartTime);
  assert.ok(lifted.get("Left white glove").getPosition().y > cut.get("Left white glove").getPosition().y + 0.6, "lift must follow the cut");
  const idle = pose("Idle", 0);
  const bodyUp = cut.get("Upper body").getRotation().transformVector(new Vec3(0, 1, 0));
  assert.ok(bodyUp.y > 0.5 && bodyUp.y < 0.8, "harvesting must bend forward from the hips");
  const leftBoot = cut.get("Left ankle").getPosition();
  const rightBoot = cut.get("Right ankle").getPosition();
  assert.ok(Math.abs(leftBoot.x - rightBoot.x) * HERO_MODEL_SCALE < 0.3, "feet must remain close to hip width");
  assert.ok((leftBoot.z - rightBoot.z) * HERO_MODEL_SCALE > 0.18, "one foot must support the forward reach");
  assert.ok(cut.get("Upper body").getPosition().y * HERO_MODEL_SCALE > 0.32, "hips must not sink into a seated squat");
  const headUp = cut.get("Hero head").getRotation().transformVector(new Vec3(0, 1, 0));
  assert.ok(headUp.y > 0.9, `head obscures the knife stroke: ${headUp}`);
  for (let frame = 0; frame <= 80; frame += 1) {
    const current = pose(action.animation, frame / 20);
    for (const side of ["Left", "Right"]) {
      const name = `${side} ankle`;
      const height = Math.abs(current.get(name).getPosition().y - idle.get(name).getPosition().y);
      const stepping = side === "Left" && (frame / 20 < 0.5 || frame / 20 > 3.2);
      assert.ok(height * HERO_MODEL_SCALE < (stepping ? 0.04 : 0.004), `${side} boot lost support at ${frame / 20}s`);
    }
  }
  for (const time of [0, action.duration]) {
    const current = pose(action.animation, time);
    for (const name of ["Upper body", "Right arm", "Left arm", "Right white glove", "Left white glove", "Left ankle", "Right ankle"]) {
      assert.ok(current.get(name).getPosition().distance(idle.get(name).getPosition()) < 0.001, `${name} did not return to Idle`);
    }
  }
});




import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Mat4, Quat, Vec3 } from "playcanvas";
import { HERO_MODEL_SCALE } from "../../../../../src/game/config/character-size.js";
import { ladderTransferOffset } from "../../../../../src/game/objects/hero/HeroLadderClimb.js";

const bytes = readFileSync(new URL("../../../../../src/game/models/hero/hero.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;

function accessor(index) {
  const item = gltf.accessors[index], view = gltf.bufferViews[item.bufferView];
  const size = {
    SCALAR: 1,
    VEC3: 3,
    VEC4: 4,
  }[item.type];
  const start = binaryStart + (view.byteOffset ?? 0) + (item.byteOffset ?? 0);

  return Array.from({ length: item.count }, (_, frame) => Array.from({ length: size }, (_, axis) => bytes.readFloatLE(start + frame * size * 4 + axis * 4)));
}

function footPosition(clip, side, phase, foot) {
  const time = 4 * (0.4 + 0.6 * phase);
  const pose = gltf.nodes.map(node => ({
    position: new Vec3(...(node.translation ?? [0, 0, 0])),
    rotation: new Quat(...(node.rotation ?? [0, 0, 0, 1])),
    scale: new Vec3(...(node.scale ?? [1, 1, 1])),
  }));
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler], times = accessor(sampler.input), values = accessor(sampler.output);
    let index = 0;
    while (index < times.length - 2 && times[index + 1][0] < time) index++;
    const blend = Math.max(0, Math.min(1, (time - times[index][0]) / (times[index + 1][0] - times[index][0] || 1)));
    const target = pose[channel.target.node], a = values[index], b = values[index + 1];
    if (channel.target.path === "rotation") target.rotation.slerp(new Quat(...a), new Quat(...b), blend);
    else if (channel.target.path === "translation") target.position.lerp(new Vec3(...a), new Vec3(...b), blend);
  }
  const backTime = Math.max(0, Math.min(1, (phase - 0.4) / 0.3));
  const back = 0.12 * backTime * backTime * (3 - 2 * backTime);
  const turnTime = Math.max(0, Math.min(1, (phase - 0.7) / 0.15));
  const rotation = new Quat().setFromEulerAngles(0, side * 90 * turnTime * turnTime * (3 - 2 * turnTime), 0);
  const external = new Mat4().setTRS(new Vec3(side * 0.8 * ladderTransferOffset(phase), 0, -back), rotation, new Vec3(HERO_MODEL_SCALE, HERO_MODEL_SCALE, HERO_MODEL_SCALE));
  const world = [];
  /**
   * @param {number} index
   * @param {Mat4} parent
   */
  function visit(index, parent) {
    const node = pose[index];
    world[index] = new Mat4().mul2(parent, new Mat4().setTRS(node.position, node.rotation, node.scale));
    for (const child of gltf.nodes[index].children ?? []) visit(child, world[index]);
  }
  for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, external);

  return world[gltf.nodes.findIndex(node => node.name === foot)].getTranslation();
}

it("keeps both exported exit clips planted between keyframes without a knee flip", () => {
  for (const [name, side, foot] of [["ClimbTop", -1, "Left ankle"], ["ClimbTopRight", 1, "Right ankle"]]) {
    const clip = gltf.animations.find(animation => animation.name === name);
    assert.ok(clip, name);
    const samples = [];
    for (let phase = 0.56; phase <= 0.69; phase += 0.002) samples.push(footPosition(clip, side, phase, foot));
    for (const axis of ["x", "y", "z"]) {
      const points = samples.map(point => point[axis]);
      const drift = Math.max(...points) - Math.min(...points);
      assert.ok(drift < 0.035, `${name} ${foot} ${axis} drift ${drift.toFixed(4)} m`);
    }
    const trailing = side > 0 ? "Left ankle" : "Right ankle";
    const turning = [];
    for (let phase = 0.72; phase <= 0.83; phase += 0.002) turning.push(footPosition(clip, side, phase, trailing));
    for (const axis of ["x", "y", "z"]) {
      const points = turning.map(point => point[axis]);
      assert.ok(Math.max(...points) - Math.min(...points) < 0.035, `${name} trailing foot slips during turn`);
    }
  }
});

it("settles into standing without a final-frame leg twist", () => {
  for (const name of ["ClimbTop", "ClimbTopRight"]) {
    const clip = gltf.animations.find(animation => animation.name === name);
    for (const channel of clip.channels) {
      if (channel.target.path !== "rotation" || !["Left leg", "Right leg"].includes(gltf.nodes[channel.target.node].name)) continue;
      const values = accessor(clip.samplers[channel.sampler].output);
      const a = new Quat(...values.at(-2)), b = new Quat(...values.at(-1));
      const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
      assert.ok(dot > 0.995, `${name} ${gltf.nodes[channel.target.node].name} twists at the end (${dot.toFixed(4)})`);
    }
  }
});

it("keeps the transfer torso upright enough to avoid tipping sideways", () => {
  for (const name of ["ClimbTop", "ClimbTopRight"]) {
    const clip = gltf.animations.find(animation => animation.name === name);
    const channel = clip.channels.find(item => item.target.path === "rotation" && gltf.nodes[item.target.node].name === "Upper body");
    assert.ok(channel, `${name} torso rotation`);
    for (const rotation of accessor(clip.samplers[channel.sampler].output)) {
      const angle = 2 * Math.acos(Math.min(1, Math.abs(rotation[3]))) * 180 / Math.PI;
      assert.ok(angle <= 22, `${name} torso tips ${angle.toFixed(1)} degrees`);
    }
  }
});

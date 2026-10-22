import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const bytes = readFileSync(new URL("../../../../../src/game/models/hero/hero.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;
const clip = gltf.animations.find((animation) => animation.name === "PickMushroom");

/**
 * @param {number} index
 * @param {number} components
 */
function accessorValues(index, components) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? components * 4;

  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: components }, (_, column) => bytes.readFloatLE(offset + row * stride + column * 4)));
}

/**
 * @param {string} nodeName
 */
function rotationsFor(nodeName) {
  const channel = clip.channels.find((candidate) =>
    candidate.target.path === "rotation" && gltf.nodes[candidate.target.node].name === nodeName);
  assert.ok(channel, `${nodeName} needs an embedded pickup rotation track`);
  const sampler = clip.samplers[channel.sampler];

  return {
    times: accessorValues(sampler.input, 1).map(([time]) => time),
    rotations: accessorValues(sampler.output, 4),
  };
}

/**
 * @param {number[]} left
 * @param {number[]} right
 */
function angleBetween(left, right) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);

  return 2 * Math.acos(Math.min(1, Math.abs(dot))) * 180 / Math.PI;
}

it("keeps the pickup wrist close to its neutral pose without a stow twist", () => {
  const { rotations } = rotationsFor("Left white glove");
  for (const rotation of rotations) {
    assert.ok(angleBetween(rotations[0], rotation) < 20, "the wrist must not fold backwards");
  }
});

it("holds the stalk until the item is hidden instead of opening the fingers early", () => {
  const { times, rotations } = rotationsFor("Left index 1");
  const contact = times.findIndex((time) => time >= 42 / 24 - 0.001);
  for (let index = contact; index < times.length && times[index] <= 82 / 24 + 0.001; index++) {
    assert.ok(angleBetween(rotations[contact], rotations[index]) < 0.1,
      `the grip opened before release at ${times[index]} seconds`);
  }
});

it("keeps the elbow continuous while lifting and stowing", () => {
  const { times, rotations } = rotationsFor("Left elbow");
  for (let index = 1; index < times.length; index++) {
    if (times[index] < 42 / 24 || times[index] > 82 / 24) {
      continue;
    }
    assert.ok(angleBetween(rotations[index - 1], rotations[index]) < 20,
      `the elbow jumped at ${times[index]} seconds`);
  }
});

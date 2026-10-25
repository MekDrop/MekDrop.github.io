import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const bytes = readFileSync(new URL("../../../../../src/game/models/hero/hero.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;

/**
 * @param {number} index
 * @param {number} components
 */
function samples(index, components) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? components * 4;

  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: components }, (_, column) =>
      bytes.readFloatLE(start + row * stride + column * 4)));
}

it("exports animated farewell rotations through the hand-only hold", () => {
  const clip = gltf.animations.find((animation) => animation.name === "LavaFarewell");
  assert.ok(clip);
  for (const name of ["Upper body", "Right arm", "Right white glove", "Right thumb 1"]) {
    const channel = clip.channels.find((candidate) =>
      candidate.target.path === "rotation" && gltf.nodes[candidate.target.node].name === name);
    assert.ok(channel, `${name} needs a farewell rotation channel`);
    const sampler = clip.samplers[channel.sampler];
    const times = samples(sampler.input, 1).flat();
    const values = samples(sampler.output, 4);
    const cubic = sampler.interpolation === "CUBICSPLINE";
    const first = values[cubic ? 1 : 0];
    const last = values[values.length - (cubic ? 2 : 1)];
    assert.ok(times.length > 1, `${name} must animate rather than export a frozen pose`);
    assert.ok(times.at(-1) >= 4.19, `${name} must retain its pose through the descent`);
    const dot = Math.abs(first.reduce((sum, value, index) => sum + value * last[index], 0));
    assert.ok(dot < 0.999, `${name} must change from anticipation to the held pose`);
    const settledIndex = times.findIndex((time) => time >= 2.04);
    const settled = values[cubic ? settledIndex * 3 + 1 : settledIndex];
    for (let index = 0; index < 4; index += 1) {
      assert.ok(Math.abs(settled[index] - last[index]) < 0.00001,
        `${name} must keep the gesture locked until fully submerged`);
    }
  }
});

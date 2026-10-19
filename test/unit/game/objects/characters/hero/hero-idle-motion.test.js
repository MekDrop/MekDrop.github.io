import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const bytes = readFileSync(new URL("../../../../../../src/game/models/hero/hero.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));

/**
 * @param {number} index
 * @returns {number[][]}
 */
function vectors(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126);
  assert.equal(accessor.type, "VEC3");
  const start = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return Array.from({ length: accessor.count }, (_, frame) =>
    Array.from({ length: 3 }, (_, axis) =>
      bytes.readFloatLE(start + frame * (view.byteStride ?? 12) + axis * 4)));
}

it("keeps idle breathing subtle without stretching the planted hero", () => {
  for (const name of ["Idle", "BoredCursorLook"]) {
    const clip = gltf.animations.find(animation => animation.name === name);
    assert.ok(clip, name);
    const rig = gltf.nodes.findIndex(node => node.name === "Hero animation rig");
    const translation = clip.channels.find(channel =>
      channel.target.node === rig && channel.target.path === "translation");
    assert.ok(translation, `${name} root motion`);
    const heights = vectors(clip.samplers[translation.sampler].output).map(value => value[1]);
    assert.ok(Math.max(...heights) - Math.min(...heights) <= 0.00201,
      `${name} breathing must not pump the body above the planted boots`);
    const scale = clip.channels.find(channel =>
      channel.target.node === rig && channel.target.path === "scale");
    if (scale) {
      for (const value of vectors(clip.samplers[scale.sampler].output)) {
        for (const axis of value) {
          assert.ok(Math.abs(axis - 1) < 0.00001, `${name} stretches the body`);
        }
      }
    }
  }
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const model = new URL("../../../../../../src/game/models/enemies/mask-shaman/mask-shaman.glb", import.meta.url);
const bytes = fs.readFileSync(model);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = bytes.subarray(28 + jsonLength);
const manifest = JSON.parse(fs.readFileSync(new URL("../../../../../../src/game/objects/enemies/mask-shaman/animation-manifest.json", import.meta.url)));

/**
 * @param {number} index
 * @returns {number[]}
 */
const values = (index) => {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const width = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
  }[accessor.type];
  const result = [];
  assert.equal(accessor.componentType, 5126);
  for (let i = 0; i < accessor.count; i++) {
    for (let j = 0; j < width; j++) {
      result.push(binary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) +
        i * (view.byteStride ?? width * 4) + j * 4));
    }
  }

  return result;
};

test("all required embedded clips have finite tracks and measured durations", () => {
  assert.equal(gltf.animations.length, 20);
  assert.equal(manifest.clips.length, 20);
  for (const clip of manifest.clips) {
    const animation = gltf.animations.find((entry) => entry.name === clip.name);
    assert.ok(animation, clip.name);
    assert.ok(animation.channels.length >= 2, clip.name);
    let duration = 0;
    for (const sampler of animation.samplers) {
      const times = values(sampler.input);
      const output = values(sampler.output);
      assert.ok(times.every(Number.isFinite), clip.name);
      assert.ok(output.every(Number.isFinite), clip.name);
      duration = Math.max(duration, ...times);
    }
    assert.ok(Math.abs(duration - clip.duration) < 0.0001, clip.name);
  }
});

test("exported source retains UVs and normalized weighted rig", () => {
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0].joints.length, 11);
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
      assert.ok(primitive.attributes.JOINTS_0 !== undefined);
      const weights = values(primitive.attributes.WEIGHTS_0);
      for (let i = 0; i < weights.length; i += 4) {
        assert.ok(Math.abs(weights.slice(i, i + 4).reduce((sum, value) => sum + value, 0) - 1) < 0.0001);
      }
    }
  }
});

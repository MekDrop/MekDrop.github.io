import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { HERO_ANIMATION } from "../../../../../src/game/enum/HeroAnimation.js";

const bytes = readFileSync(new URL(
  "../../../../../src/game/models/hero/variants/special-artojas/special-artojas.glb",
  import.meta.url,
));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;

/**
 * @param {number} index
 * @returns {number[][]}
 */
function samples(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const components = {
    SCALAR: 1,
    VEC3: 3,
    VEC4: 4,
  }[accessor.type];
  const sizes = {
    5121: 1,
    5123: 2,
    5126: 4,
  };
  const size = sizes[accessor.componentType];
  const start = binaryOffset + (view?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  const rows = Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: components }, (_, column) => {
      if (!view) {
        return 0;
      }
      const offset = start + row * (view.byteStride ?? components * size) + column * size;
      if (accessor.componentType === 5126) {
        return bytes.readFloatLE(offset);
      }
      const value = size === 1 ? bytes.readUInt8(offset) : bytes.readUInt16LE(offset);

      return accessor.normalized ? value / (size === 1 ? 255 : 65535) : value;
    }));
  if (accessor.sparse) {
    const { count, indices, values } = accessor.sparse;
    const indexView = gltf.bufferViews[indices.bufferView];
    const valueView = gltf.bufferViews[values.bufferView];
    const indexSize = sizes[indices.componentType];
    const indexStart = binaryOffset + (indexView.byteOffset ?? 0) + (indices.byteOffset ?? 0);
    const valueStart = binaryOffset + (valueView.byteOffset ?? 0) + (values.byteOffset ?? 0);
    for (let index = 0; index < count; index++) {
      const offset = indexStart + index * indexSize;
      const row = indexSize === 1 ? bytes.readUInt8(offset) : bytes.readUInt16LE(offset);
      for (let component = 0; component < components; component++) {
        rows[row][component] = bytes.readFloatLE(valueStart + (index * components + component) * 4);
      }
    }
  }

  return rows;
}

it("exports every required hero clip, including the petting reaction", () => {
  const names = new Set(gltf.animations.map((animation) => animation.name));
  for (const name of Object.values(HERO_ANIMATION)) {
    assert.ok(names.has(name), `Missing ${name}`);
  }
  for (const name of ["Hero head", "Left arm", "Right arm", "Left white glove", "Right white glove"]) {
    assert.ok(gltf.nodes.some((node) => node.name === name), `Missing attachment ${name}`);
  }
});

it("has normalized skin weights on the head, both arms and both legs", () => {
  const skin = gltf.skins[0];
  const weighted = new Map();
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const joints = samples(primitive.attributes.JOINTS_0);
      const weights = samples(primitive.attributes.WEIGHTS_0);
      weights.forEach((row, vertex) => {
        assert.ok(Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 0.001);
        row.forEach((weight, influence) => {
          if (weight > 0.1) {
            const name = gltf.nodes[skin.joints[joints[vertex][influence]]].name;
            weighted.set(name, (weighted.get(name) ?? 0) + 1);
          }
        });
      });
    }
  }
  for (const name of ["Hero head", "Left arm", "Right arm", "Left leg", "Right leg"]) {
    assert.ok(weighted.get(name) > 20, `${name} must actually deform the mesh`);
  }
});

it("contains changing limb tracks and the facial petting shapes", () => {
  for (const [clip, joint] of [["Walk", "Left leg"], ["PatAnnoyed", "Left arm"]]) {
    const animation = gltf.animations.find((entry) => entry.name === clip);
    const channel = animation.channels.find((entry) =>
      gltf.nodes[entry.target.node].name === joint && entry.target.path === "rotation");
    const values = samples(animation.samplers[channel.sampler].output);
    assert.ok(values.some((row) => row.some((value, column) => Math.abs(value - values[0][column]) > 0.01)), `${clip}: ${joint} must move`);
  }
  const targets = gltf.meshes.flatMap((mesh) => mesh.extras?.targetNames ?? []);
  for (const name of ["HappyPat", "AngryPat", "AnnoyedPat", "Blink"]) {
    assert.ok(targets.includes(name));
  }
});

it("grounds the soles at zero and visibly lifts the textured mouth corners", () => {
  const primitive = gltf.meshes[0].primitives[0];
  const positions = samples(primitive.attributes.POSITION);
  const minimumY = Math.min(...positions.map((position) => position[1]));
  assert.ok(Math.abs(minimumY) < 0.001, `Soles must meet the ground, got ${minimumY}`);

  const happyIndex = gltf.meshes[0].extras.targetNames.indexOf("HappyPat");
  const deltas = samples(primitive.targets[happyIndex].POSITION);
  const cornerLifts = positions.flatMap(([x, y, z], index) => {
    const distance = Math.abs(x - 0.075);

    return y > 1.85 && y < 2.04 && z > 0.28 && distance > 0.08 && distance < 0.22
      ? [deltas[index][1]] : [];
  });
  assert.ok(Math.max(...cornerLifts) > 0.04, "Petting must raise the actual mouth corners visibly");
});

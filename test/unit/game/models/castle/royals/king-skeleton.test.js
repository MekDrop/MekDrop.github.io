import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const buffer = readFileSync(new URL(
  "../../../../../../src/game/models/castle/royals/king.glb",
  import.meta.url,
));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;
const parents = new Map();
gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parents.set(child, index)));

/**
 * @param {number} index
 * @returns {Array<number>}
 */
function values(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const components = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
  }[accessor.type];
  const bytes = {
    5121: 1,
    5123: 2,
    5125: 4,
    5126: 4,
  }[accessor.componentType];
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return Array.from({ length: accessor.count * components }, (_, item) => {
    const row = Math.floor(item / components);
    const column = item % components;
    const offset = start + row * (view.byteStride ?? components * bytes) + column * bytes;
    if (accessor.componentType === 5126) {
      return buffer.readFloatLE(offset);
    }
    const value = buffer.readUIntLE(offset, bytes);

    return accessor.normalized ? value / (2 ** (bytes * 8) - 1) : value;
  });
}

/**
 * @param {string} name
 * @returns {number}
 */
function nodeIndex(name) {
  const index = gltf.nodes.findIndex((node) => node.name === name);
  assert.notEqual(index, -1, `missing humanoid node ${name}`);

  return index;
}

/**
 * @param {string} child
 * @param {string} ancestor
 */
function descendsFrom(child, ancestor) {
  const target = nodeIndex(ancestor);
  let parent = parents.get(nodeIndex(child));
  while (parent !== undefined && parent !== target) {
    parent = parents.get(parent);
  }
  assert.equal(parent, target, `${child} must follow ${ancestor}`);
}

it("king exports one humanoid skeleton with articulated limbs and fingers", () => {
  assert.equal(gltf.skins?.length, 1, "the king must use one actual glTF skin");
  nodeIndex("King skeleton");
  const skin = gltf.skins[0];
  const joints = new Set(skin.joints.map((index) => gltf.nodes[index].name));
  for (const name of ["Royal animation rig", "Royal hips", "Royal spine", "Royal chest", "Royal neck", "Royal head rig"]) {
    assert.ok(joints.has(name), `${name} must be an exported skin joint`);
  }
  for (const side of ["left", "right"]) {
    for (const name of [
      `Royal ${side} arm rig`,
      `Royal ${side} elbow`,
      `Royal ${side} hand`,
      `Royal ${side} leg rig`,
      `Royal ${side} knee`,
      `King ${side} foot`,
      `King ${side} toe`,
    ]) {
      assert.ok(joints.has(name), `${name} must be an exported skin joint`);
    }
    for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
      for (const segment of [1, 2]) {
        assert.ok(joints.has(`King ${side} ${digit} ${segment}`), `${side} ${digit} needs two articulated joints`);
      }
    }
  }
  assert.equal(gltf.accessors[skin.inverseBindMatrices].count, skin.joints.length);
  assert.ok(values(skin.inverseBindMatrices).every(Number.isFinite), "inverse bind matrices must remain finite");
});

it("humanoid joints form continuous anatomical chains and preserve runtime attachments", () => {
  descendsFrom("Royal hips", "Royal animation rig");
  descendsFrom("Royal spine", "Royal hips");
  descendsFrom("Royal chest", "Royal spine");
  descendsFrom("Royal neck", "Royal chest");
  descendsFrom("Royal head rig", "Royal neck");
  for (const side of ["left", "right"]) {
    descendsFrom(`Royal ${side} arm rig`, "Royal chest");
    descendsFrom(`Royal ${side} elbow`, `Royal ${side} arm rig`);
    descendsFrom(`Royal ${side} hand`, `Royal ${side} elbow`);
    descendsFrom(`Royal ${side} leg rig`, "Royal hips");
    descendsFrom(`Royal ${side} knee`, `Royal ${side} leg rig`);
    descendsFrom(`King ${side} foot`, `Royal ${side} knee`);
    descendsFrom(`King ${side} toe`, `King ${side} foot`);
    for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
      descendsFrom(`King ${side} ${digit} 1`, `Royal ${side} hand`);
      descendsFrom(`King ${side} ${digit} 2`, `King ${side} ${digit} 1`);
    }
    for (const name of [`Royal ${side} eye`, `Royal ${side} tear surface`]) {
      assert.equal(parents.get(nodeIndex(name)), nodeIndex("Royal head rig"), `${name} must retain its head-local attachment`);
    }
  }
  assert.equal(parents.get(nodeIndex("King sword")), nodeIndex("Royal left hand"), "sword must remain directly attached to the gripping hand");
});

it("the deforming joints influence real geometry with normalized bounded weights", () => {
  assert.ok(gltf.skins?.length, "skin data must exist before checking deform weights");
  const weighted = new Set();
  let skinnedVertices = 0;
  for (const node of gltf.nodes) {
    if (node.skin === undefined || node.mesh === undefined) {
      continue;
    }
    const skin = gltf.skins[node.skin];
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      assert.notEqual(primitive.attributes.JOINTS_0, undefined, "skinned geometry requires joint indices");
      assert.notEqual(primitive.attributes.WEIGHTS_0, undefined, "skinned geometry requires weights");
      const indices = values(primitive.attributes.JOINTS_0);
      const weights = values(primitive.attributes.WEIGHTS_0);
      assert.equal(weights.length, indices.length);
      skinnedVertices += weights.length / 4;
      for (let vertex = 0; vertex < weights.length; vertex += 4) {
        let total = 0;
        for (let influence = 0; influence < 4; influence++) {
          const index = indices[vertex + influence];
          const weight = weights[vertex + influence];
          assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1, "skin weights must remain finite and nonnegative");
          assert.ok(Number.isInteger(index) && index >= 0 && index < skin.joints.length, "joint indices must refer to the exported skin");
          total += weight;
          if (weight > 0.0001) {
            weighted.add(gltf.nodes[skin.joints[index]].name);
          }
        }
        assert.ok(Math.abs(total - 1) < 0.0001, "every skinned vertex must have normalized weights");
      }
    }
  }
  assert.ok(skinnedVertices > 100, "a rig must deform the character, not just export empty bones");
  for (const side of ["left", "right"]) {
    for (const name of [`Royal ${side} elbow`, `Royal ${side} knee`, `King ${side} foot`]) {
      assert.ok(weighted.has(name), `${name} must deform visible geometry`);
    }
    for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
      for (const segment of [1, 2]) {
        assert.ok(weighted.has(`King ${side} ${digit} ${segment}`), `${side} ${digit} ${segment} must deform a finger surface`);
      }
    }
  }
});

it("the walking clips articulate knees and elbows instead of rigid limb objects", () => {
  for (const name of ["TerraceWalk", "WalkOut"]) {
    const clip = gltf.animations.find((animation) => animation.name === name);
    assert.ok(clip, `${name} must survive rig conversion`);
    for (const side of ["left", "right"]) {
      for (const joint of [`Royal ${side} knee`, `Royal ${side} elbow`]) {
        const channel = clip.channels.find(({ target }) => gltf.nodes[target.node].name === joint && target.path === "rotation");
        assert.ok(channel, `${name} must animate ${joint}`);
        const rotations = values(clip.samplers[channel.sampler].output);
        const variation = [0, 1, 2, 3].some((component) => {
          const components = rotations.filter((_, index) => index % 4 === component);

          return Math.max(...components) - Math.min(...components) > 0.01;
        });
        assert.ok(variation, `${joint} must actually bend in ${name}`);
      }
    }
  }
});

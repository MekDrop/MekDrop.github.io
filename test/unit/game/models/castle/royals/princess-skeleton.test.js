import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Mat4, Quat, Vec3 } from "playcanvas";

const buffer = readFileSync(new URL("../../../../../../src/game/models/castle/royals/princess.glb", import.meta.url));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
const binaryOffset = 28 + jsonLength;

/**
 * @param {number} index
 * @returns {Array<number>}
 */
function floats(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const size = {
    SCALAR: 1,
    VEC3: 3,
    VEC4: 4,
  }[accessor.type];
  const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return Array.from({ length: accessor.count * size }, (_, i) => buffer.readFloatLE(offset + i * 4));
}

/**
 * @param {string} clipName
 * @param {boolean|number} last
 * @returns {Map<string, Mat4>}
 */
function poseMatrices(clipName, last) {
  const clip = gltf.animations.find((animation) => animation.name === clipName);
  const transforms = gltf.nodes.map((node) => ({
    translation: node.translation ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0, 1],
    scale: node.scale ?? [1, 1, 1],
  }));
  for (const channel of clip.channels) {
    const data = floats(clip.samplers[channel.sampler].output);
    const count = channel.target.path === "rotation" ? 4 : 3;
    const times = floats(clip.samplers[channel.sampler].input);
    const sample = typeof last === "number"
      ? Math.max(0, times.findLastIndex((time) => time <= last + 0.00001))
      : last ? times.length - 1 : 0;
    transforms[channel.target.node][channel.target.path] = data.slice(sample * count, (sample + 1) * count);
  }
  const parents = new Map();
  gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parents.set(child, index)));
  const matrices = new Map();
  /**
   * @param {number} index
   * @returns {Mat4}
   */
  function world(index) {
    if (matrices.has(index)) {
      return matrices.get(index);
    }
    const values = transforms[index];
    const matrix = new Mat4().setTRS(new Vec3(...values.translation), new Quat(...values.rotation), new Vec3(...values.scale));
    if (parents.has(index)) {
      matrix.mul2(world(parents.get(index)), matrix.clone());
    }
    matrices.set(index, matrix);

    return matrix;
  }

  return new Map(gltf.nodes.map((node, index) => [node.name, world(index)]));
}

it("princess geometry is skinned to articulated legs and ten two-joint fingers", () => {
  assert.ok(gltf.skins?.length, "export must contain an actual skin");
  const joints = new Set(gltf.skins.flatMap((skin) => skin.joints.map((index) => gltf.nodes[index].name)));
  for (const side of ["left", "right"]) {
    for (const name of [`Royal ${side} leg rig`, `Royal ${side} knee`, `Princess ${side} foot`]) {
      assert.ok(joints.has(name), name);
    }
    for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
      for (const segment of [1, 2]) {
        assert.ok(joints.has(`Princess ${side} ${digit} ${segment}`));
      }
    }
  }
  for (const node of gltf.nodes) {
    if (node.skin === undefined || node.mesh === undefined) {
      continue;
    }
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      assert.notEqual(primitive.attributes.JOINTS_0, undefined);
      const weights = floats(primitive.attributes.WEIGHTS_0);
      for (let i = 0; i < weights.length; i += 4) {
        const sum = weights.slice(i, i + 4).reduce((total, weight) => total + weight, 0);
        assert.ok(Math.abs(sum - 1) < 0.0001, "every vertex has normalized skin weights");
      }
    }
  }
});

it("walk animates both knees and the sitting transition bends the hips", () => {
  const walk = gltf.animations.find((clip) => clip.name === "TerraceWalk");
  for (const side of ["left", "right"]) {
    const channel = walk.channels.find(({ target }) => gltf.nodes[target.node].name === `Royal ${side} knee` && target.path === "rotation");
    assert.ok(channel, "walking must animate the knee, not just the model root");
    const values = floats(walk.samplers[channel.sampler].output);
    assert.ok(Math.max(...values.filter((_, index) => index % 4 === 0)) - Math.min(...values.filter((_, index) => index % 4 === 0)) > 0.1);
  }
  const sit = gltf.animations.find((clip) => clip.name === "TerraceSit");
  const channel = sit.channels.find(({ target }) => gltf.nodes[target.node].name === "Royal left leg rig" && target.path === "rotation");
  const values = floats(sit.samplers[channel.sampler].output);
  const dot = values.slice(0, 4).reduce((total, value, index) => total + value * values.at(-4 + index), 0);
  assert.ok(2 * Math.acos(Math.min(1, Math.abs(dot))) > 1.4, "the transition bends the thigh approximately 90 degrees");
});

it("crying keeps the legs standing rather than reusing the chair pose", () => {
  const cry = gltf.animations.find((clip) => clip.name === "Cry");
  for (const name of ["Royal left leg rig", "Royal right leg rig", "Royal left knee", "Royal right knee"]) {
    const channel = cry.channels.find(({ target }) => gltf.nodes[target.node].name === name && target.path === "rotation");
    const values = floats(cry.samplers[channel.sampler].output);
    const rest = gltf.nodes[channel.target.node].rotation ?? [0, 0, 0, 1];
    const dot = rest.reduce((total, value, index) => total + value * values[index], 0);
    assert.ok(Math.abs(dot) > 0.99, `${name} stays in the standing bind pose`);
  }
});

it("the seated pelvis rests on the chair and both hands stay above the lap", () => {
  const pose = poseMatrices("RoyalSit", false);
  const scale = 0.76;
  const seatTop = 0.4295;
  const thighRadius = 0.055;
  for (const side of ["left", "right"]) {
    const hip = pose.get(`Royal ${side} leg rig`).getTranslation();
    const underside = (hip.y - thighRadius) * scale;
    assert.ok(underside >= seatTop - 0.003 && underside <= seatTop + 0.016, "thighs leave only a fabric-sized clearance above the seat");
    const hand = pose.get(`Royal ${side} hand`).getTranslation();
    assert.ok(hand.y * scale > seatTop + 0.08, "hand remains on the lap, clear of the chair and feet");
  }
});

it("the sit-down endpoint matches the held seated pose for every skin joint", () => {
  const end = poseMatrices("TerraceSit", true);
  const held = poseMatrices("RoyalSit", false);
  for (const index of gltf.skins[0].joints) {
    const name = gltf.nodes[index].name;
    const a = end.get(name).data;
    const b = held.get(name).data;
    for (let component = 0; component < 16; component++) {
      assert.ok(Math.abs(a[component] - b[component]) < 0.0001, `${name} must not snap when the sitting transition finishes`);
    }
  }
});

it("standing to leave starts from the same supported seated pose", () => {
  const start = poseMatrices("WalkOut", false);
  const held = poseMatrices("RoyalSit", false);
  for (const index of gltf.skins[0].joints) {
    const name = gltf.nodes[index].name;
    const a = start.get(name).data;
    const b = held.get(name).data;
    for (let component = 0; component < 16; component++) {
      assert.ok(Math.abs(a[component] - b[component]) < 0.0001, `${name} must not snap when getting up`);
    }
  }
});

it("tea service starts from the held seated pose without dropping a wrist", () => {
  const drinking = poseMatrices("TerraceDrink", false);
  const held = poseMatrices("RoyalSit", false);
  for (const name of ["Royal animation rig", "Royal left hand", "Royal right hand"]) {
    assert.ok(drinking.get(name).getTranslation().distance(held.get(name).getTranslation()) < 0.0001, name);
  }
});

it("the gown has continuous cloth topology and baked deformation below the pinned waist", () => {
  const cloth = gltf.nodes.find((node) => node.name.startsWith("Panelled bell gown") && node.mesh !== undefined);
  const primitives = gltf.meshes[cloth.mesh].primitives;
  const vertices = primitives.reduce((count, primitive) => count + gltf.accessors[primitive.attributes.POSITION].count, 0);
  assert.ok(vertices >= 500, "fabric needs enough topology for folds between waist and hem");
  const skin = gltf.skins[cloth.skin];
  const clothJoints = skin.joints.map((index) => gltf.nodes[index].name).filter((name) => name.startsWith("Princess cloth "));
  assert.ok(clothJoints.length >= 128, "export must retain the simulated cloth deformation");
  const lengths = [0, 0.5, 1, 1.5, 2].map((time) => {
    const pose = poseMatrices("TerraceSit", time);

    return pose.get("Princess cloth 16 00").getTranslation().distance(pose.get("Princess cloth 00 00").getTranslation());
  });
  assert.ok(Math.max(...lengths) - Math.min(...lengths) > 0.04, "the hem folds and drapes independently of the waist");
});

it("the facial surface is a full head joined to the neck rather than a shallow shell", () => {
  const node = gltf.nodes.find((candidate) => candidate.name.startsWith("Royal face") && candidate.mesh !== undefined);
  const mesh = gltf.meshes[node.mesh];
  const points = [];
  const graph = new Map();
  for (const primitive of mesh.primitives) {
    const positions = floats(primitive.attributes.POSITION);
    const keys = [];
    for (let i = 0; i < positions.length; i += 3) {
      const point = positions.slice(i, i + 3);
      points.push(point);
      const key = point.map((value) => Math.round(value * 100000)).join(",");
      keys.push(key);
      if (!graph.has(key)) {
        graph.set(key, new Set());
      }
    }
    const accessor = gltf.accessors[primitive.indices];
    const view = gltf.bufferViews[accessor.bufferView];
    const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const bytes = {
      5121: 1,
      5123: 2,
      5125: 4,
    }[accessor.componentType];
    const indices = Array.from({length: accessor.count}, (_, i) => buffer.readUIntLE(offset + i * bytes, bytes));
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = indices.slice(i, i + 3).map((index) => keys[index]);
      for (let edge = 0; edge < 3; edge++) {
        const a = triangle[edge];
        const b = triangle[(edge + 1) % 3];
        graph.get(a).add(b);
        graph.get(b).add(a);
      }
    }
  }
  assert.ok(Math.max(...points.map((point) => point[2])) - Math.min(...points.map((point) => point[2])) > 0.5, "the cranium needs depth behind the face");
  assert.ok(Math.min(...points.map((point) => point[1])) < 0.9, "the same skin volume reaches the neck");
  const seen = new Set();
  const queue = [graph.keys().next().value];
  while (queue.length) {
    const key = queue.pop();
    if (!seen.has(key)) {
      seen.add(key);
      queue.push(...graph.get(key));
    }
  }
  assert.equal(seen.size, graph.size, "the exported face and neck form one connected surface");
});

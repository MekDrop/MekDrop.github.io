import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Mat4, Quat, Vec3 } from "playcanvas";

const buffer = readFileSync(new URL("../../../../../../src/game/models/castle/royals/queen.glb", import.meta.url));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
const binaryOffset = 28 + jsonLength;
const clipNames = ["Cry", "RoyalSit", "TerraceIdle", "TerraceMountSunbed", "TerraceRead", "TerraceRecline", "TerraceWalk", "WalkOut"];

/**
 * @param {number} index
 * @returns {Array<number>}
 */
function floats(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const count = {
    SCALAR: 1,
    VEC3: 3,
    VEC4: 4,
  }[accessor.type];
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return Array.from({ length: accessor.count * count }, (_, i) => buffer.readFloatLE(start + i * 4));
}

it("queen exports a humanoid skeleton with two articulated segments per digit", () => {
  assert.equal(gltf.skins.length, 1);
  const joints = new Set(gltf.skins[0].joints.map((i) => gltf.nodes[i].name));
  for (const name of ["Royal hips", "Royal spine", "Royal chest", "Royal neck", "Royal head rig"]) {
    assert.ok(joints.has(name), name);
  }
  for (const side of ["left", "right"]) {
    for (const name of [`Queen ${side} shoulder`, `Royal ${side} arm rig`, `Royal ${side} elbow`, `Royal ${side} hand`, `Royal ${side} leg rig`, `Royal ${side} knee`, `Queen ${side} foot`, `Queen ${side} toe`]) {
      assert.ok(joints.has(name), name);
    }
    for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
      for (const segment of [1, 2]) {
        assert.ok(joints.has(`Queen ${side} ${digit} ${segment}`));
      }
    }
  }
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      assert.notEqual(primitive.attributes.JOINTS_0, undefined);
      const weights = floats(primitive.attributes.WEIGHTS_0);
      for (let i = 0; i < weights.length; i += 4) {
        const sum = weights.slice(i, i + 4).reduce((total, weight) => total + weight, 0);
        assert.ok(Math.abs(sum - 1) < 0.0001, "normalized vertex weights");
      }
    }
  }
});

it("the gown covers one connected body from the waist through both legs", () => {
  const node = gltf.nodes.find((item) => item.name === "Queen continuous body");
  assert.ok(node?.mesh !== undefined, "the dress must not hide a missing pelvis");
  const adjacency = new Map();
  const edges = new Map();
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const positions = floats(primitive.attributes.POSITION);
    const vertices = Array.from({ length: positions.length / 3 }, (_, index) => positions.slice(index * 3, index * 3 + 3).map((value) => value.toFixed(5)).join(","));
    for (const vertex of vertices) {
      if (!adjacency.has(vertex)) {
        adjacency.set(vertex, new Set());
      }
    }
    const accessor = gltf.accessors[primitive.indices];
    const view = gltf.bufferViews[accessor.bufferView];
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const bytes = accessor.componentType === 5125 ? 4 : 2;
    const indices = Array.from({ length: accessor.count }, (_, index) => bytes === 4 ? buffer.readUInt32LE(start + index * bytes) : buffer.readUInt16LE(start + index * bytes));
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      for (let corner = 0; corner < 3; corner++) {
        const a = vertices[indices[triangle + corner]];
        const b = vertices[indices[triangle + (corner + 1) % 3]];
        adjacency.get(a).add(b);
        adjacency.get(b).add(a);
        const edge = [a, b].sort().join("/");
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
  }
  const unseen = new Set(adjacency.keys());
  const pending = [unseen.values().next().value];
  unseen.delete(pending[0]);
  while (pending.length) {
    const vertex = pending.pop();
    for (const neighbor of adjacency.get(vertex)) {
      if (unseen.delete(neighbor)) {
        pending.push(neighbor);
      }
    }
  }
  assert.equal(unseen.size, 0, "waist, seat, crotch, thighs, and calves must share a connected surface");
  for (const count of edges.values()) {
    assert.equal(count, 2, "the underlying body must be closed");
  }
});

it("every original performance contains baked body and fabric motion", () => {
  assert.deepEqual(gltf.animations.map((clip) => clip.name).sort(), clipNames);
  for (const clip of gltf.animations) {
    for (const name of ["Royal left hand", "Royal right hand", "Royal head rig", "Queen gown 09 00"]) {
      const channel = clip.channels.find(({ target }) => gltf.nodes[target.node].name === name && target.path === "translation");
      assert.ok(channel, `${clip.name}: ${name}`);
      const data = floats(clip.samplers[channel.sampler].output);
      assert.ok(data.every(Number.isFinite));
    }
    const channel = clip.channels.find(({ target }) => gltf.nodes[target.node].name === "Queen gown 09 00" && target.path === "translation");
    const positions = floats(clip.samplers[channel.sampler].output);
    assert.ok(positions.some((value, i) => Math.abs(value - positions[i % 3]) > 0.0001), `${clip.name}: cloth must deform`);
  }
});

it("walking flexes the knees independently and keeps separate finger geometry", () => {
  const walk = gltf.animations.find((clip) => clip.name === "TerraceWalk");
  for (const side of ["left", "right"]) {
    const channel = walk.channels.find(({ target }) => gltf.nodes[target.node].name === `Royal ${side} knee` && target.path === "rotation");
    const rotations = floats(walk.samplers[channel.sampler].output);
    assert.ok(rotations.some((value, i) => Math.abs(value - rotations[i % 4]) > 0.01));
    for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
      assert.ok(gltf.nodes.some((node) => node.name === `Queen ${side} ${digit}` && node.mesh !== undefined));
    }
  }
});

/**
 * Read the exported pose, including parent rotations and root scale.
 * @param {string} name
 * @returns {Map<string, Vec3>}
 */
function firstPosePositions(name) {
  const clip = gltf.animations.find((animation) => animation.name === name);
  const transforms = gltf.nodes.map((node) => ({
    translation: node.translation ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0, 1],
    scale: node.scale ?? [1, 1, 1],
  }));
  for (const { target, sampler } of clip.channels) {
    transforms[target.node][target.path] = floats(clip.samplers[sampler].output).slice(0, target.path === "rotation" ? 4 : 3);
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
    const pose = transforms[index];
    const matrix = new Mat4().setTRS(new Vec3(...pose.translation), new Quat(...pose.rotation), new Vec3(...pose.scale));
    if (parents.has(index)) {
      matrix.mul2(world(parents.get(index)), matrix.clone());
    }
    matrices.set(index, matrix);

    return matrix;
  }

  return new Map(gltf.nodes.map((node, index) => [node.name, world(index).getTranslation()]));
}

it("seated fabric falls over the knees and reclining rear panels follow the legs", () => {
  const seated = firstPosePositions("RoyalSit");
  const knee = seated.get("Queen gown 05 00");
  const hem = seated.get("Queen gown 09 00");
  assert.ok(knee.y - hem.y > 0.20, "front fabric must descend from the lap instead of forming a horizontal plate");
  for (const name of ["TerraceRead", "TerraceRecline"]) {
    const pose = firstPosePositions(name);
    const front = pose.get("Queen gown 09 00");
    const back = pose.get("Queen gown 09 12");
    assert.ok(Math.abs(front.z - back.z) < 0.10, `${name}: both sides of the hem must travel to the feet`);
    assert.ok(front.y > back.y, `${name}: cloth must wrap above and below the extended legs`);
  }
});

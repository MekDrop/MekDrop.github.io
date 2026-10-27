import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Mat4, Quat, Ray, Tri, Vec3 } from "playcanvas";

/**
 * @typedef {{name: string, points: Vec3[], triangles: number[][], minimum: Vec3, maximum: Vec3, closed: boolean}} AttachmentIsland
 */

const buffer = readFileSync(new URL("../../../../../../src/game/models/castle/royals/king.glb", import.meta.url));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;
const accessorCache = new Map();
const parents = new Map();
gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parents.set(child, index)));
const CONTACT_ALLOWANCE = 0.006;

/**
 * @param {number} index
 * @returns {number[]}
 */
function values(index) {
  if (accessorCache.has(index)) {
    return accessorCache.get(index);
  }
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
  const result = Array.from({ length: accessor.count * components }, (_, item) => {
    const row = Math.floor(item / components), column = item % components;
    const offset = start + row * (view.byteStride ?? components * bytes) + column * bytes;
    if (accessor.componentType === 5126) {
      return buffer.readFloatLE(offset);
    }
    const value = buffer.readUIntLE(offset, bytes);

    return accessor.normalized ? value / (2 ** (bytes * 8) - 1) : value;
  });
  accessorCache.set(index, result);

  return result;
}

/**
 * @param {string} name
 * @param {number} time
 * @returns {Mat4[]}
 */
function pose(name, time) {
  const clip = gltf.animations.find((animation) => animation.name === name);
  assert.ok(clip, `${name} animation exists`);
  const transforms = gltf.nodes.map((node) => ({
    translation: node.translation ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0, 1],
    scale: node.scale ?? [1, 1, 1],
  }));
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler];
    const times = values(sampler.input), data = values(sampler.output);
    const size = channel.target.path === "rotation" ? 4 : 3;
    const first = Math.max(0, times.findLastIndex((value) => value <= time));
    const second = Math.min(first + 1, times.length - 1);
    const amount = first === second || sampler.interpolation === "STEP" ? 0 : (time - times[first]) / (times[second] - times[first]);
    const a = data.slice(first * size, (first + 1) * size), b = data.slice(second * size, (second + 1) * size);
    transforms[channel.target.node][channel.target.path] = size === 4
      ? new Quat().slerp(new Quat(...a), new Quat(...b), amount).toArray()
      : a.map((value, index) => value + (b[index] - value) * amount);
  }
  const matrices = new Map();
  /**
   * @param {number} index
   * @returns {Mat4}
   */
  function world(index) {
    if (matrices.has(index)) {
      return matrices.get(index);
    }
    const transform = transforms[index];
    const matrix = new Mat4().setTRS(new Vec3(...transform.translation), new Quat(...transform.rotation), new Vec3(...transform.scale));
    if (parents.has(index)) {
      matrix.mul2(world(parents.get(index)), matrix.clone());
    }
    matrices.set(index, matrix);

    return matrix;
  }

  return gltf.nodes.map((_, index) => world(index));
}

/**
 * Weld exported normal/material splits before finding actual triangle islands.
 * @param {string} name
 * @param {number} time
 * @param {Set<string>|null} [selection]
 * @returns {AttachmentIsland[]}
 */
function islands(name, time, selection = null) {
  const matrices = pose(name, time);
  const result = [];
  for (let nodeIndex = 0; nodeIndex < gltf.nodes.length; nodeIndex++) {
    const node = gltf.nodes[nodeIndex];
    if (node.mesh === undefined || /tear/i.test(node.name) || selection && !selection.has(node.name)) {
      continue;
    }
    const skin = gltf.skins?.[node.skin];
    const inverse = skin ? values(skin.inverseBindMatrices) : null;
    const bones = skin?.joints.map((joint, index) => new Mat4().mul2(matrices[joint], new Mat4().set(inverse.slice(index * 16, index * 16 + 16))));
    const welded = new Map(), points = [], triangles = [], roots = [];
    /**
     * @param {number} index
     * @returns {number}
     */
    function root(index) {
      while (roots[index] !== index) {
        roots[index] = roots[roots[index]];
        index = roots[index];
      }

      return index;
    }
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const positions = values(primitive.attributes.POSITION);
      const joints = skin ? values(primitive.attributes.JOINTS_0) : null;
      const weights = skin ? values(primitive.attributes.WEIGHTS_0) : null;
      const mapping = [];
      for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        const source = new Vec3(...positions.slice(vertex * 3, vertex * 3 + 3));
        const point = new Vec3();
        if (skin) {
          for (let influence = 0; influence < 4; influence++) {
            const weight = weights[vertex * 4 + influence];
            if (weight > 0) {
              point.addScaled(bones[joints[vertex * 4 + influence]].transformPoint(source), weight);
            }
          }
        } else {
          matrices[nodeIndex].transformPoint(source, point);
        }
        const key = point.toArray().map((value) => Math.round(value * 100000)).join(",");
        let index = welded.get(key);
        if (index === undefined) {
          index = points.length;
          points.push(point);
          roots.push(index);
          welded.set(key, index);
        }
        mapping.push(index);
      }
      const indices = values(primitive.indices);
      for (let face = 0; face < indices.length; face += 3) {
        const triangle = indices.slice(face, face + 3).map((index) => mapping[index]);
        if (new Set(triangle).size < 3) {
          continue;
        }
        triangles.push(triangle);
        roots[root(triangle[1])] = root(triangle[0]);
        roots[root(triangle[2])] = root(triangle[0]);
      }
    }
    const groups = new Map();
    for (const triangle of triangles) {
      const index = root(triangle[0]);
      if (!groups.has(index)) {
        groups.set(index, []);
      }
      groups.get(index).push(triangle);
    }
    for (const faces of groups.values()) {
      const minimum = new Vec3(Infinity, Infinity, Infinity), maximum = new Vec3(-Infinity, -Infinity, -Infinity);
      const used = [...new Set(faces.flat())];
      const local = new Map(used.map((index, offset) => [index, offset]));
      const vertices = used.map((index) => points[index]);
      const edgeCounts = new Map();
      for (const triangle of faces) {
        for (let edge = 0; edge < 3; edge++) {
          const a = triangle[edge], b = triangle[(edge + 1) % 3];
          const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
          edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
        }
      }
      for (const vertex of vertices) {
        minimum.min(vertex);
        maximum.max(vertex);
      }
      result.push({
        name: node.name,
        points: vertices,
        triangles: faces.map((face) => face.map((index) => local.get(index))),
        minimum,
        maximum,
        closed: [...edgeCounts.values()].every((count) => count === 2),
      });
    }
  }

  return result;
}

/**
 * @param {Vec3} p
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {Vec3} c
 * @returns {number}
 */
function pointTriangleDistance(p, a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) {
    return p.distance(a);
  }
  const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) {
    return p.distance(b);
  }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    return p.distance(a.clone().addScaled(ab, d1 / (d1 - d3)));
  }
  const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) {
    return p.distance(c);
  }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    return p.distance(a.clone().addScaled(ac, d2 / (d2 - d6)));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return p.distance(b.clone().addScaled(c.clone().sub(b), (d4 - d3) / (d4 - d3 + d5 - d6)));
  }
  const inverse = 1 / (va + vb + vc);

  return p.distance(a.clone().addScaled(ab, vb * inverse).addScaled(ac, vc * inverse));
}

/**
 * @param {Vec3} point
 * @param {AttachmentIsland} island
 * @returns {boolean}
 */
function inside(point, island) {
  if (!island.closed) {
    return false;
  }
  const ray = new Ray(point, new Vec3(0.733, 0.512, 0.443).normalize());
  const hit = new Vec3(), distances = new Set();
  for (const face of island.triangles) {
    const triangle = new Tri(...face.map((index) => island.points[index]));
    if (triangle.intersectsRay(ray, hit)) {
      distances.add(Math.round(point.distance(hit) * 100000));
    }
  }

  return distances.size % 2 === 1;
}

/**
 * A broad-phase bounds overlap is never sufficient: test triangle surfaces,
 * crossing edges, and closed-volume containment before accepting attachment.
 * @param {AttachmentIsland} a
 * @param {AttachmentIsland} b
 * @returns {boolean}
 */
function contact(a, b) {
  const gap = Math.hypot(
    Math.max(0, a.minimum.x - b.maximum.x, b.minimum.x - a.maximum.x),
    Math.max(0, a.minimum.y - b.maximum.y, b.minimum.y - a.maximum.y),
    Math.max(0, a.minimum.z - b.maximum.z, b.minimum.z - a.maximum.z),
  );
  if (gap > CONTACT_ALLOWANCE) {
    return false;
  }
  for (const [source, target] of [[a, b], [b, a]]) {
    for (const point of source.points) {
      for (const face of target.triangles) {
        const corners = face.map((index) => target.points[index]);
        if (pointTriangleDistance(point, ...corners) <= CONTACT_ALLOWANCE) {
          return true;
        }
      }
    }
    if (inside(source.points[0], target)) {
      return true;
    }
    const ray = new Ray(), hit = new Vec3();
    for (const face of source.triangles) {
      for (let edge = 0; edge < 3; edge++) {
        const first = source.points[face[edge]], second = source.points[face[(edge + 1) % 3]];
        const length = first.distance(second);
        ray.origin.copy(first);
        ray.direction.sub2(second, first).normalize();
        for (const targetFace of target.triangles) {
          const triangle = new Tri(...targetFace.map((index) => target.points[index]));
          if (triangle.intersectsRay(ray, hit) && first.distance(hit) <= length + 0.000001) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

const contactPoses = gltf.animations.map((animation) => [
  animation.name,
  values(animation.samplers[0].input).at(-1) / 2,
]);

/**
 * Find the actual sleeve vertices sewn rigidly into the chest, rather than
 * accepting an accessory elsewhere on the arm as an indirect contact path.
 * @param {string} side
 * @param {Mat4[]} matrices
 * @returns {Vec3[]}
 */
function shoulderSeam(side, matrices) {
  const node = gltf.nodes.find((candidate) => candidate.name === `${side} articulated navy sleeve`);
  assert.ok(node && node.skin !== undefined, `${side} shoulder requires a skinned sleeve`);
  const skin = gltf.skins[node.skin];
  const chest = skin.joints.findIndex((index) => gltf.nodes[index].name === "Royal chest");
  const inverse = values(skin.inverseBindMatrices);
  const matrix = new Mat4().mul2(matrices[skin.joints[chest]], new Mat4().set(inverse.slice(chest * 16, chest * 16 + 16)));
  const points = new Map();
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const positions = values(primitive.attributes.POSITION);
    const joints = values(primitive.attributes.JOINTS_0), weights = values(primitive.attributes.WEIGHTS_0);
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      let sewnWeight = 0;
      for (let influence = 0; influence < 4; influence++) {
        if (joints[vertex * 4 + influence] === chest) {
          sewnWeight += weights[vertex * 4 + influence];
        }
      }
      if (sewnWeight > 0.999) {
        const point = matrix.transformPoint(new Vec3(...positions.slice(vertex * 3, vertex * 3 + 3)));
        const key = point.toArray().map((value) => Math.round(value * 100000)).join(",");
        points.set(key, point);
      }
    }
  }

  return [...points.values()];
}

it("both complete shoulder cross-sections stay sewn into the chest at five poses per clip", () => {
  const selection = new Set(["left articulated navy sleeve", "right articulated navy sleeve", "Royal animation rig - Dynasty midnight wool"]);
  const chest = gltf.nodes.findIndex((node) => node.name === "Royal chest");
  for (const animation of gltf.animations) {
    const duration = values(animation.samplers[0].input).at(-1);
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const time = duration * fraction;
      const matrices = pose(animation.name, time);
      const parts = islands(animation.name, time, selection);
      const torso = parts.filter((part) => part.name === "Royal animation rig - Dynasty midnight wool");
      const inverse = matrices[chest].clone().invert();
      for (const side of ["left", "right"]) {
        const label = `${animation.name} at ${fraction}: ${side} shoulder`;
        const sleeves = parts.filter((part) => part.name === `${side} articulated navy sleeve`);
        assert.equal(sleeves.length, 1, `${label} must be one continuous shoulder-and-sleeve surface`);
        assert.ok(sleeves[0].closed, `${label} must not leave an open armhole`);
        const seam = shoulderSeam(side, matrices);
        assert.ok(seam.length >= 8, `${label} needs a complete sewn cross-section, not a single contact corner`);
        const local = seam.map((point) => inverse.transformPoint(point));
        const height = Math.max(...local.map((point) => point.y)) - Math.min(...local.map((point) => point.y));
        const depth = Math.max(...local.map((point) => point.z)) - Math.min(...local.map((point) => point.z));
        assert.ok(height > 0.22 && depth > 0.28, `${label} must cover the full shoulder opening`);
        for (const point of seam) {
          assert.ok(torso.some((part) => inside(point, part)), `${label} has a sewn edge vertex outside the torso`);
        }
      }
    }
  }
});

it("each palm and forearm share one continuous skinned wrist surface", () => {
  for (const side of ["left", "right"]) {
    const node = gltf.nodes.find((value) => value.name === `Royal ${side} hand surface`);
    assert.ok(node && node.skin !== undefined, `${side} wrist requires an actual skin`);
    const skin = gltf.skins[node.skin];
    const anchored = new Set();
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const joints = values(primitive.attributes.JOINTS_0);
      const weights = values(primitive.attributes.WEIGHTS_0);
      for (let index = 0; index < joints.length; index++) {
        if (weights[index] > 0.999) {
          anchored.add(gltf.nodes[skin.joints[joints[index]]].name);
        }
      }
    }
    assert.ok(anchored.has(`Royal ${side} elbow`), `${side} wrist must extend into the forearm`);
    assert.ok(anchored.has(`Royal ${side} hand`), `${side} palm must share that wrist surface`);
  }
});

it("the face and both temples share a closed head shell beneath the original hair", () => {
  const head = gltf.nodes.findIndex((node) => node.name === "Royal head rig");
  const node = gltf.nodes.find((candidate) => candidate.name === "Royal face");
  assert.ok(node && node.skin !== undefined, "the complete head shell must be skinned");
  const skin = gltf.skins[node.skin];
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const joints = values(primitive.attributes.JOINTS_0), weights = values(primitive.attributes.WEIGHTS_0);
    for (let index = 0; index < joints.length; index++) {
      if (weights[index] > 0.0001) {
        assert.equal(skin.joints[joints[index]], head, "head surfaces must follow the head rigidly");
      }
    }
  }
  const parts = islands("TerraceIdle", 0, new Set(["Royal face"]));
  assert.equal(parts.length, 1, "the temples and face must form one connected surface");
  assert.ok(parts[0].closed, "the head must not have open side or scalp edges");
  const inverse = pose("TerraceIdle", 0)[head].clone().invert();
  const local = parts[0].points.map((point) => inverse.transformPoint(point));
  const front = Math.max(...local.map((point) => point.z));
  assert.ok(Math.abs(front - 0.52) < 0.0001, "the existing front facial surface must retain its authored depth");
  for (const side of [-1, 1]) {
    for (const landmark of [new Vec3(side * 0.28, 0.20, 0.26), new Vec3(side * 0.23, 0.38, 0.255)]) {
      const temple = pose("TerraceIdle", 0)[head].transformPoint(landmark);
      assert.ok(inside(temple, parts[0]), "both the lower temple and the strip under the crown need actual head volume");
    }
  }
  for (const landmark of [new Vec3(0, 0.08, 0.52), new Vec3(-0.335, 0.08, 0.4094427), new Vec3(0.335, 0.08, 0.4094427)]) {
    assert.ok(local.some((point) => point.distance(landmark) < 0.0001), "front and cheek landmarks must retain their original positions");
  }
});

for (const [clip, time] of contactPoses) {
  it(`${clip} keeps every visible king surface physically attached to the body`, () => {
    const parts = islands(clip, time);
    const body = parts.findIndex((part) => part.name === "Indigo bodice front");
    assert.ok(body >= 0, "the attachment graph must have an actual torso surface");
    const reached = new Set([body]);
    const queue = [body];
    while (queue.length) {
      const current = queue.pop();
      for (let other = 0; other < parts.length; other++) {
        if (!reached.has(other) && contact(parts[current], parts[other])) {
          reached.add(other);
          queue.push(other);
        }
      }
    }
    const detached = parts.filter((_, index) => !reached.has(index)).map((part) => part.name);
    assert.deepEqual(detached, [], `${clip} has surfaces without a physical contact path: ${detached.join(", ")}`);
    for (const name of ["King connected neck", "King left brooch backing", "King right brooch backing", "King connected necklace chain"]) {
      assert.ok(parts.some((part) => part.name === name), `${name} must export real connector geometry`);
    }
    for (const side of ["left", "right"]) {
      const palms = parts.filter((part) => part.name === `Royal ${side} hand surface`);
      const cuffs = parts.filter((part) => part.name === `${side} ermine wrist cuff`);
      assert.equal(palms.length, 1, `${clip}: ${side} palm and wrist must form one surface island`);
      assert.ok(palms[0].closed, `${clip}: ${side} wrist must not have an open join`);
      assert.ok(cuffs.some((cuff) => contact(palms[0], cuff)), `${clip}: ${side} wrist must meet its cuff directly`);
    }
  });
}

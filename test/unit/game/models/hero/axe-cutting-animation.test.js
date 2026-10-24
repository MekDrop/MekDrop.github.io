import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Mat4, Quat, Vec3 } from "playcanvas";
import { HERO_MODEL_SCALE } from "../../../../../src/game/config/character-size.js";
import { AxeSupportGrip } from "../../../../../src/game/objects/characters/hero/tools/AxeSupportGrip.js";

const buffer = readFileSync(new URL(
  "../../../../../src/game/models/hero/hero.glb",
  import.meta.url,
));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;
const sampleCache = new Map();

/**
 * @param {number} index
 */
function samples(index) {
  if (sampleCache.has(index)) {
    return sampleCache.get(index);
  }
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const count = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
  }[accessor.type];
  const componentBytes = {
    5121: 1,
    5123: 2,
    5125: 4,
    5126: 4,
  }[accessor.componentType];
  const read = {
    5121: "readUInt8",
    5123: "readUInt16LE",
    5125: "readUInt32LE",
    5126: "readFloatLE",
  }[accessor.componentType];
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  const values = Array.from({ length: accessor.count }, (_, sample) =>
    Array.from({ length: count }, (_, component) =>
      buffer[read](start + sample * (view.byteStride ?? count * componentBytes) + component * componentBytes)));
  sampleCache.set(index, values);

  return values;
}

/**
 * @param {string} name
 * @param {number} time
 */
function pose(name, time, previous = null) {
  const nodes = gltf.nodes.map((node) => {
    const entity = new Entity(node.name);
    entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
    entity.setLocalRotation(new Quat(...(node.rotation ?? [0, 0, 0, 1])));
    entity.setLocalScale(...(node.scale ?? [1, 1, 1]));
    if (previous) {
      const before = previous.get(node.name);
      entity.setLocalPosition(before.getLocalPosition());
      entity.setLocalRotation(before.getLocalRotation());
      entity.setLocalScale(before.getLocalScale());
    }

    return entity;
  });
  gltf.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      nodes[index].addChild(nodes[child]);
    }
  });
  const animation = gltf.animations.find((animation) => animation.name === name);
  for (const channel of animation.channels) {
    if (channel.target.path === "weights") {
      continue;
    }
    const sampler = animation.samplers[channel.sampler];
    if (name.startsWith("Chop")) {
      assert.equal(sampler.interpolation ?? "LINEAR", "LINEAR", name + " preserves sampled linear keys");
    }
    const times = samples(sampler.input).flat();
    const values = samples(sampler.output);
    const sampleTime = Math.min(time, times.at(-1));
    let index = times.findIndex((sample) => sample >= sampleTime);
    if (index < 0) {
      index = times.length - 1;
    }
    const previous = sampler.interpolation === "STEP" && times[index] === sampleTime
      ? index : Math.max(0, index - 1);
    const amount = index === previous || sampler.interpolation === "STEP" ? 0
      : (sampleTime - times[previous]) / (times[index] - times[previous]);
    const entity = nodes[channel.target.node];
    if (channel.target.path === "rotation") {
      entity.setLocalRotation(new Quat().slerp(
        new Quat(...values[previous]),
        new Quat(...values[index]),
        amount,
      ));
    } else {
      const value = new Vec3().lerp(new Vec3(...values[previous]), new Vec3(...values[index]), amount);
      if (channel.target.path === "translation") {
        entity.setLocalPosition(value);
      } else {
        entity.setLocalScale(value);
      }
    }
  }

  return new Map(nodes.map((node) => [node.name, node]));
}



const CHOPS = ["ChopLow", "ChopRow2", "ChopMiddle", "ChopRow4", "ChopRow5", "ChopHigh", "ChopRow7"];
const CUT_FACES = [0.95, 0.95, 1.01, 0.98, 0.90, 0.68, 0.50];

function meshWorldVertices(node, primitive, rig) {
  const vertices = samples(primitive.attributes.POSITION);
  if (node.skin === undefined) {
    return vertices.map(vertex => rig.get(node.name).getWorldTransform().transformPoint(new Vec3(...vertex)));
  }
  const skin = gltf.skins[node.skin];
  const matrices = samples(skin.inverseBindMatrices).map((values, index) =>
    rig.get(gltf.nodes[skin.joints[index]].name).getWorldTransform().clone().mul(new Mat4().set(values)));
  const joints = samples(primitive.attributes.JOINTS_0);
  const weights = samples(primitive.attributes.WEIGHTS_0);

  return vertices.map((vertex, index) => {
    const point = new Vec3();
    for (let influence = 0; influence < 4; influence++) {
      if (weights[index][influence] > 0) {
        point.add(matrices[joints[index][influence]].transformPoint(new Vec3(...vertex))
          .mulScalar(weights[index][influence]));
      }
    }

    return point;
  });
}

it("keeps each complete boot rigid throughout all exported animations", () => {
  const idle = pose("Idle", 1 / 24);
  for (const [side, suffix] of [["Left", ""], ["Right", ".001"]]) {
    const foot = "Boot foot" + suffix;
    const parts = ["Boot cuff", "Boot front strap", "Boot shaft", "Boot heel", "Boot sole", "Boot toe"]
      .map(name => name + suffix).concat([side + " boot buckle", side + " boot cuff seam"]);
    const reference = new Map(parts.map(name => [name,
      idle.get(foot).getWorldTransform().clone().invert().mul(idle.get(name).getWorldTransform())]));
    for (const animation of gltf.animations) {
      const duration = Math.max(...animation.samplers.map(sampler => samples(sampler.input).at(-1)[0]));
      for (let frame = 0; frame <= 30; frame++) {
        const time = duration * frame / 30;
        const rig = pose(animation.name, time);
        const inverse = rig.get(foot).getWorldTransform().clone().invert();
        for (const name of parts) {
          const relative = inverse.clone().mul(rig.get(name).getWorldTransform());
          const difference = Math.max(...relative.data.map((value, index) => Math.abs(value - reference.get(name).data[index])));
          assert.ok(difference < .0001, animation.name + " deforms " + name + " relative to its sole at " + time);
        }
      }
    }
  }
});

it("keeps both shoulder joints attached to their torso sockets", () => {
  const idle = pose("Idle", 1 / 24);
  for (const name of [...CHOPS, "SummonAxe", "DismissAxe"]) {
    for (let frame = 0; frame <= 180; frame++) {
      const current = pose(name, frame / 120);
      for (const side of ["Left", "Right"]) {
        const shoulder = current.get(`${side} arm`);
        const socket = idle.get(`${side} arm`);
        assert.ok(shoulder.getLocalPosition().distance(socket.getLocalPosition()) < 0.001,
          name + " detaches the " + side + " shoulder at " + frame / 120);
        assert.ok(shoulder.getLocalScale().distance(socket.getLocalScale()) < 0.001,
          name + " stretches the " + side + " shoulder at " + frame / 120);
      }
    }
  }
});

it("draws and stows with neutral legs instead of inheriting the last cutting pose", () => {
  const idle = pose("Idle", 1 / 24);
  for (const clip of ["SummonAxe", "DismissAxe"]) {
    const current = pose(clip, .4, pose("ChopLow", .6));
    for (const name of ["Hero animation rig", "Left leg", "Left knee", "Left ankle", "Right leg", "Right knee", "Right ankle"]) {
      assert.ok(current.get(name).getLocalPosition().distance(idle.get(name).getLocalPosition()) < .0001,
        clip + " retains a cutting translation on " + name);
      assert.ok(Math.abs(current.get(name).getLocalRotation().dot(idle.get(name).getLocalRotation())) > .99999,
        clip + " retains a cutting rotation on " + name);
    }
  }
});

const axeBuffer = readFileSync(new URL("../../../../../src/game/models/hero/tools/axe.glb", import.meta.url));
const axe = JSON.parse(axeBuffer.subarray(20, 20 + axeBuffer.readUInt32LE(12)));
const headOffset = axe.nodes.find((node) => node.name === "Axe head").translation;

/**
 * @param {string} name
 * @param {number} time
 * @param {Map<string, Entity>} [rig]
 * @param {boolean} [maintainSupport]
 * @param {number} [stanceClearance]
 */
function cuttingPose(name, time, rig = pose(name, time), maintainSupport = false, stanceClearance = 0) {
  for (const entity of rig.values()) {
    if (!entity.parent) {
      entity.setLocalScale(HERO_MODEL_SCALE, HERO_MODEL_SCALE, HERO_MODEL_SCALE);
    }
  }
  const tool = new Entity("Test axe grip");
  (rig.get("Axe grip") ?? rig.get("Right white glove")).addChild(tool);
  tool.setLocalPosition(0, -0.08, 0.095);
  tool.setLocalEulerAngles(0, 0, 90);
  const blade = new Entity("Axe head");
  tool.addChild(blade);
  blade.setLocalPosition(...headOffset);
  if (maintainSupport) {
    new AxeSupportGrip({ findByName: name => rig.get(name) }).update(tool, true, stanceClearance);
  }
  const head = tool.getWorldTransform().transformPoint(new Vec3(...headOffset));
  const grip = tool.getPosition().clone();
  const shaft = head.clone().sub(grip);
  const support = rig.get("Left white glove").getWorldTransform()
    .transformPoint(new Vec3(0, -0.08, 0.095)).sub(grip);
  const along = Math.max(-0.14 / 1.24, Math.min(1, support.dot(shaft) / shaft.lengthSq()));
  const supportError = support.distance(shaft.clone().mulScalar(along));

  return {
    rig,
    tool,
    head,
    supportError,
    supportAlong: support.dot(shaft) / shaft.lengthSq(),
    gripErrors: ["Right", "Left"].flatMap(side => ["index", "middle", "ring", "little"].map((finger) => {
      const knuckle = rig.get(`${side} ${finger} 2`).getPosition().clone().sub(grip);
      const along = knuckle.dot(shaft) / shaft.lengthSq();

      return knuckle.distance(shaft.clone().mulScalar(along));
    })),
    edge: tool.getWorldTransform().transformVector(new Vec3(-1, 0, 0)).normalize(),
  };
}

it("keeps rigid soles grounded during the highest reach and lowest cut", () => {
  const idle = cuttingPose("Idle", 1 / 24).rig;
  for (const clip of ["ChopLow", "ChopRow7"]) {
    for (const suffix of ["", ".001"]) {
      const names = ["Boot sole", "Boot heel", "Boot toe", "Boot foot"].map(name => name + suffix);
      const geometry = names.map(name => {
        const node = gltf.nodes.find(node => node.name === name);

        return {
          name,
          points: gltf.meshes[node.mesh].primitives.flatMap(primitive => samples(primitive.attributes.POSITION).map(point => new Vec3(...point))),
        };
      });
      const bottom = rig => Math.min(...geometry.flatMap(({name, points}) => points.map(point => rig.get(name).getWorldTransform().transformPoint(point).y)));
      const floor = bottom(idle);
      let previous;
      for (let frame = 0; frame <= 90; frame++) {
        const rig = cuttingPose(clip, frame / 60).rig;
        assert.ok(Math.abs(bottom(rig) - floor) < .01, clip + " sinks or floats a sole at " + frame / 60);
        const position = rig.get("Boot foot" + suffix).getPosition().clone();
        if (previous) {
          assert.ok(position.distance(previous) < .025, clip + " jerks a boot at " + frame / 60);
        }
        previous = position;
      }
    }
  }
});

it("keeps the shin seated at the cuff throughout all exported animations", () => {
  const idle = pose("Idle", 1 / 24);
  for (const [side, suffix] of [["Left", ""], ["Right", ".001"]]) {
    const cuff = "Boot cuff" + suffix;
    const cuffNode = gltf.nodes.find(node => node.name === cuff);
    const cuffBounds = gltf.accessors[gltf.meshes[cuffNode.mesh].primitives[0].attributes.POSITION];
    const kneeInCuff = idle.get(cuff).getWorldTransform().clone().invert()
      .transformPoint(idle.get(side + " knee").getPosition());
    assert.ok([kneeInCuff.x, kneeInCuff.y, kneeInCuff.z].every((value, axis) =>
      value >= cuffBounds.min[axis] - .015 && value <= cuffBounds.max[axis] + .015),
    side + " knee sits inside the actual cuff opening");
    const foot = "Boot foot" + suffix;
    const reference = idle.get(foot).getWorldTransform().clone().invert().transformPoint(idle.get(side + " knee").getPosition());
    for (const animation of gltf.animations) {
      const duration = Math.max(...animation.samplers.map(sampler => samples(sampler.input).at(-1)[0]));
      for (let frame = 0; frame <= 30; frame++) {
        const rig = pose(animation.name, duration * frame / 30);
        const seat = rig.get(foot).getWorldTransform().clone().invert().transformPoint(rig.get(side + " knee").getPosition());
        assert.ok(seat.distance(reference) < .0001, animation.name + " pulls the " + side + " shin out of its boot");
      }
    }
  }
});

it("chops accelerate into a left-to-right strike with the cutting edge leading", () => {
  for (const name of CHOPS) {
    const windup = cuttingPose(name, 0.48).head;
    assert.ok(windup.distance(cuttingPose(name, 0).head) > 0.06, name + " visibly prepares the swing");
    const contact = cuttingPose(name, 0.60);
    const follow = cuttingPose(name, 0.74).head;
    const withdrawn = cuttingPose(name, 1.08).head;
    const strikeSpeed = contact.head.distance(windup) / 0.12;
    const withdrawSpeed = withdrawn.distance(follow) / 0.34;
    assert.ok(windup.x < -0.16 && follow.x > (name === "ChopRow7" ? 0.18 : 0.26),
      name + " crosses left to right within its two-handed reach");
    assert.ok(contact.edge.x > 0.5, name + " cuts with the bit rather than the poll");
    assert.ok(strikeSpeed > withdrawSpeed * 1.6, name + " has a distinct fast strike");
  }
});

const BODY_CLEARANCE_MESHES = [
  "Rounded chest armor", "Short red tunic", "Round face", "Bright cyan hair cap",
  "Cyan hair mass", "Boot foot", "Boot foot.001", "Thick trouser leg", "Thick trouser leg.001",
  "Boot cuff", "Boot cuff.001", "Boot shaft", "Boot shaft.001",
  "Boot front strap", "Boot front strap.001", "Boot heel", "Boot heel.001",
  "Boot sole", "Boot sole.001", "Boot toe", "Boot toe.001",
  "Left boot buckle", "Right boot buckle", "Left boot cuff seam", "Right boot cuff seam",
  "Blue forearm cuff", "Emerald pauldron",
  "Right Blue forearm cuff", "Right Emerald pauldron",
];

it("keeps the hero outside the remaining vegetation face", () => {
  const bodies = gltf.nodes.filter((node) => node.mesh !== undefined
    && !/boot/i.test(node.name) && [...BODY_CLEARANCE_MESHES, "Left white glove", "Right white glove"].includes(node.name));
  for (const [row, name] of CHOPS.entries()) {
    const face = CUT_FACES[row];
    for (let frame = 0; frame <= 90; frame++) {
      const time = frame / 60;
      const rig = cuttingPose(name, time).rig;
      const remainingTop = (row + (time < 0.60 ? 1 : 0)) * 0.25;
      for (const node of bodies) {
        const matrix = rig.get(node.name).getWorldTransform();
        for (const primitive of gltf.meshes[node.mesh].primitives) {
          for (const vertex of samples(primitive.attributes.POSITION)) {
            const point = matrix.transformPoint(new Vec3(...vertex));
            if (point.y > 0 && point.y < remainingTop) {
              assert.ok(point.z < face - 0.005,
                name + " pushes " + node.name + " into the plant at " + time);
            }
          }
        }
      }
    }
  }
});

it("keeps every hero part, including accessories and fingers, clear of the remaining tree cells", () => {
  const plantBuffer = readFileSync(new URL("../../../../../src/game/models/vegetation/tall-tree.glb", import.meta.url));
  const plant = JSON.parse(plantBuffer.subarray(20, 20 + plantBuffer.readUInt32LE(12)));
  const cells = plant.nodes.flatMap(node => {
    const match = node.name?.match(/^Voxel cell (-?\d+) (-?\d+) (-?\d+)/);

    return match ? [{
      x: +match[1],
      y: +match[2],
      z: +match[3],
    }] : [];
  });
  assert.ok(cells.length > 0, "uses actual exported vegetation cells");
  for (const [row, name] of CHOPS.entries()) {
    const remaining = cells.filter(cell => cell.y <= row);
    const distance = Math.max(...remaining.map(cell => -cell.z)) * .25 + .125 + CUT_FACES[row];
    for (let frame = 0; frame <= 90; frame++) {
      const rig = cuttingPose(name, frame / 60).rig;
      for (const node of gltf.nodes) {
        if (node.mesh === undefined) {
          continue;
        }
        for (const primitive of gltf.meshes[node.mesh].primitives) {
          for (const point of meshWorldVertices(node, primitive, rig)) {
            const overlaps = remaining.some(cell => Math.abs(point.x - cell.x * .25) < .115
              && Math.abs(point.z - distance - cell.z * .25) < .115
              && point.y > cell.y * .25 + .01 && point.y < (cell.y + 1) * .25 - .01);
            assert.equal(overlaps, false, name + " clips " + node.name + " into the tree at " + frame / 60);
          }
        }
      }
    }
  }
});

const axeNodes = axe.nodes.map((node) => {
  const entity = new Entity(node.name);
  entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
  entity.setLocalRotation(new Quat(...(node.rotation ?? [0, 0, 0, 1])));
  entity.setLocalScale(...(node.scale ?? [1, 1, 1]));

  return entity;
});
axe.nodes.forEach((node, index) => {
  for (const child of node.children ?? []) {
    axeNodes[index].addChild(axeNodes[child]);
  }
});
const axeVertices = axe.nodes.flatMap((node, index) => {
  if (node.mesh === undefined) {
    return [];
  }

  return axe.meshes[node.mesh].primitives.flatMap((primitive) => {
    const accessor = axe.accessors[primitive.attributes.POSITION];
    const view = axe.bufferViews[accessor.bufferView];
    const start = 28 + axeBuffer.readUInt32LE(12) + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

    return Array.from({ length: accessor.count }, (_, vertex) => {
      const offset = start + vertex * (view.byteStride ?? 12);

      const point = axeNodes[index].getWorldTransform().transformPoint(new Vec3(
        axeBuffer.readFloatLE(offset), axeBuffer.readFloatLE(offset + 4), axeBuffer.readFloatLE(offset + 8),
      ));
      point.part = node.name;

      return point;
    });
  });
});

it("only lets the blade enter the cut layer and keeps clear of the remaining rows", () => {
  for (const [row, name] of CHOPS.entries()) {
    const face = CUT_FACES[row];
    const contact = cuttingPose(name, 0.60);
    const bladeReach = Math.max(...axeVertices.filter(vertex => /head|bevel/.test(vertex.part))
      .map(vertex => contact.tool.getWorldTransform().transformPoint(vertex).z));
    assert.ok(bladeReach >= face + 0.005, name + " makes physical contact at impact");
    for (let frame = 0; frame <= 180; frame++) {
      const time = frame / 120;
      const { tool } = cuttingPose(name, time);
      for (const vertex of axeVertices) {
        const point = tool.getWorldTransform().transformPoint(vertex);
        if (point.z <= face + 0.005) {
          continue;
        }
        assert.ok(point.y >= row * 0.25 + 0.005,
          name + " clips the remaining row with " + vertex.part + " at " + time);
        const remainingTop = time < 0.60 ? (row + 1) * 0.25 : row * 0.25;
        if (point.y >= remainingTop) {
          continue;
        }
        assert.ok(/head|bevel/.test(vertex.part), name + " pushes its handle into the plant at " + time);
        // The low stroke settles onto its level before traversing the wide base.
        const contactStart = name === "ChopLow" ? .34 : .48;
        assert.ok(time >= contactStart, name + " enters the wood before the strike at " + time);
      }
    }
  }
});

const triangleCache = new Map();
function insideBodyMesh(point, primitive) {
  let triangles = triangleCache.get(primitive);
  if (!triangles) {
    const positions = samples(primitive.attributes.POSITION);
    const a = gltf.accessors[primitive.indices];
    const view = gltf.bufferViews[a.bufferView];
    const start = binaryOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const indices = Array.from({length:a.count}, (_, i) => a.componentType === 5125 ? buffer.readUInt32LE(start+i*4) : buffer.readUInt16LE(start+i*2));
    triangles = [];
    for (let i=0;i<indices.length;i+=3) {
      const v = new Vec3(...positions[indices[i]]);
      triangles.push([v, new Vec3(...positions[indices[i+1]]).sub(v), new Vec3(...positions[indices[i+2]]).sub(v)]);
    }
    triangleCache.set(primitive, triangles);
  }
  return insideTriangles(point, triangles);
}

function insideTriangles(point, triangles) {
  const ray = new Vec3(1,0.12347,0.07123);
  let crossings = 0;
  for (const [a,e1,e2] of triangles) {
    const h = new Vec3().cross(ray,e2), det = e1.dot(h);
    if (Math.abs(det)<1e-9) {
      continue;
    }
    const offset = point.clone().sub(a), u = offset.dot(h)/det;
    if (u<0 || u>1) {
      continue;
    }
    const q = new Vec3().cross(offset,e1), v = ray.dot(q)/det;
    if (v<0 || u+v>1) {
      continue;
    }
    if(e2.dot(q)/det>1e-6) {
      crossings++;
    }
  }

  return crossings % 2 === 1;
}

const CLOTH_MESHES = ["Continuous trousers", "Left continuous sleeve", "Right continuous sleeve"];

it("uses welded, closed cloth surfaces with normalized weights on the live body joints", () => {
  for (const name of CLOTH_MESHES) {
    const node = gltf.nodes.find(node => node.name === name);
    const skin = gltf.skins[node.skin];
    assert.ok(skin.joints.every(index => !gltf.nodes[index].name.startsWith("Cloth ")),
      "terrain placement and grip corrections deform the same cloth skin");
    const primitive = gltf.meshes[node.mesh].primitives[0];
    const positions = samples(primitive.attributes.POSITION);
    const weights = samples(primitive.attributes.WEIGHTS_0);
    weights.forEach(values => assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < .00001));
    const keys = positions.map(vertex => vertex.map(value => value.toFixed(5)).join(","));
    const edges = new Map();
    const neighbors = new Map();
    const indices = samples(primitive.indices).flat();
    for (let i = 0; i < indices.length; i += 3) {
      for (let edge = 0; edge < 3; edge++) {
        const a = keys[indices[i + edge]], b = keys[indices[i + (edge + 1) % 3]];
        const key = [a, b].sort().join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
        if (!neighbors.has(a)) {
          neighbors.set(a, new Set());
        }
        neighbors.get(a).add(b);
      }
    }
    assert.ok([...edges.values()].every(count => count === 2), name + " has no open seam");
    const reached = new Set(), pending = [keys[indices[0]]];
    while (pending.length) {
      const key = pending.pop();
      if (!reached.has(key)) {
        reached.add(key);
        pending.push(...neighbors.get(key));
      }
    }
    assert.equal(reached.size, neighbors.size, name + " is one connected surface");
  }
});

it("keeps the axe outside the evaluated cloth surfaces through every cutting height", () => {
  for (const name of CHOPS) {
    for (let frame = 0; frame <= 90; frame++) {
      const { rig, tool } = cuttingPose(name, frame / 60);
      const points = axeVertices.map(vertex => tool.getWorldTransform().transformPoint(vertex));
      for (const cloth of CLOTH_MESHES) {
        const node = gltf.nodes.find(node => node.name === cloth);
        const primitive = gltf.meshes[node.mesh].primitives[0];
        const vertices = meshWorldVertices(node, primitive, rig);
        const min = ["x", "y", "z"].map(axis => Math.min(...vertices.map(point => point[axis])));
        const max = ["x", "y", "z"].map(axis => Math.max(...vertices.map(point => point[axis])));
        const candidates = points.filter(point => [point.x, point.y, point.z].every((value, axis) =>
          value > min[axis] + .005 && value < max[axis] - .005));
        if (!candidates.length) {
          continue;
        }
        const indices = samples(primitive.indices).flat();
        const triangles = [];
        for (let i = 0; i < indices.length; i += 3) {
          const a = vertices[indices[i]];
          triangles.push([a, vertices[indices[i + 1]].clone().sub(a), vertices[indices[i + 2]].clone().sub(a)]);
        }
        assert.ok(candidates.every(point => !insideTriangles(point, triangles)),
          name + " intersects deformed " + cloth + " at " + frame / 60);
      }
    }
  }
});

it("keeps garment trim and elbow covers attached to their moving surfaces", () => {
  const parents = new Map();
  gltf.nodes.forEach(node => (node.children ?? []).forEach(child => parents.set(gltf.nodes[child].name, node.name)));
  assert.equal(parents.get("Tunic shadow hem"), "Upper body");
  for (const side of ["Left", "Right"]) {
    assert.equal(parents.get(side + " elbow joint"), side + " elbow");
    const node = gltf.nodes.find(node => node.name === side + " elbow joint");
    assert.ok(new Vec3(...(node.translation ?? [0, 0, 0])).length() < .001, side + " cover sits at the actual elbow");
  }
});

it("keeps flexible sleeves embedded in the tunic and gloves through every exported clip", () => {
  for (const side of ["Left", "Right"]) {
    const node = gltf.nodes.find(node => node.name === side + " continuous sleeve");
    assert.notEqual(node.skin, undefined, "sleeves deform instead of separating at rigid joints");
    const skin = gltf.skins[node.skin];
    const primitive = gltf.meshes[node.mesh].primitives[0];
    const joints = samples(primitive.attributes.JOINTS_0);
    const weights = samples(primitive.attributes.WEIGHTS_0);
    const caps = ["Upper body", side + " white glove"].map(name => ({
      target: name === "Upper body" ? "Short red tunic" : name,
      vertices: weights.flatMap((values, index) => values.some((weight, influence) => weight > .999
        && gltf.nodes[skin.joints[joints[index][influence]]].name === name) ? [index] : []),
    }));
    for (const cap of caps) {
      assert.ok(cap.vertices.length >= 12, "closed sleeve end is bound to its adjoining body part");
    }
    for (const animation of gltf.animations) {
      const duration = Math.max(...animation.samplers.map(sampler => samples(sampler.input).at(-1)[0]));
      for (let frame = 0; frame <= 12; frame++) {
        const rig = pose(animation.name, duration * frame / 12);
        const vertices = meshWorldVertices(node, primitive, rig);
        for (const cap of caps) {
          const center = cap.vertices.reduce((point, index) => point.add(vertices[index]), new Vec3())
            .mulScalar(1 / cap.vertices.length);
          const point = rig.get(cap.target).getWorldTransform().clone().invert().transformPoint(center);
          const target = gltf.nodes.find(node => node.name === cap.target);
          assert.ok(insideBodyMesh(point, gltf.meshes[target.mesh].primitives[0]),
            animation.name + " detaches the " + side + " sleeve from " + cap.target);
        }
      }
    }
  }
});

it("keeps the complete axe mesh outside the hero's head, torso and legs", () => {
  for (const name of CHOPS) {
    for (let frame = 0; frame <= 180; frame++) {
      const { rig, tool } = cuttingPose(name, frame / 120);
      for (const bodyName of BODY_CLEARANCE_MESHES) {
        const node = gltf.nodes.find((node) => node.name === bodyName);
        const primitive = gltf.meshes[node.mesh].primitives[0];
        const bounds = gltf.accessors[primitive.attributes.POSITION];
        const inverse = rig.get(bodyName).getWorldTransform().clone().invert();
        const relative = inverse.mul(tool.getWorldTransform());
        const intruding = axeVertices.some((vertex) => {
          const point = relative.transformPoint(vertex);

          const inside = [point.x, point.y, point.z].every((value, axis) =>
            value > bounds.min[axis] + 0.01 && value < bounds.max[axis] - 0.01);

          return inside && insideBodyMesh(point, primitive);
        });
        assert.equal(intruding, false, name + " axe intersects " + bodyName + " at " + frame / 120);
      }
    }
  }
});

it("contact stays in the removed layer and pauses briefly at impact", () => {
  for (const [row, name] of CHOPS.entries()) {
    const contact = cuttingPose(name, 0.60);
    assert.ok(Math.abs(contact.head.y - (row * 0.25 + 0.125)) <= 0.025,
      name + " strikes the layer centre in world space: " + contact.head.y);
    for (const time of [0.58, 0.62, 0.68, 0.74]) {
      const height = cuttingPose(name, time).head.y;
      assert.ok(Math.abs(height - (row * 0.25 + 0.125)) <= 0.025,
        name + " holds the cutting plane throughout the strike at " + time + ": " + height);
    }
    assert.ok(contact.head.y >= row * 0.25 - 0.01, name + " reaches its cut layer");
    assert.ok(contact.head.y <= (row + 1) * 0.25 + 0.01, name + " stays inside the layer");

    assert.ok(contact.head.distance(cuttingPose(name, 0.62).head) < 0.035, name + " pauses briefly at contact");
  }
});

it("withdraws clear of the trunk before lowering the axe for recovery", () => {
  for (const name of CHOPS) {
    const follow = cuttingPose(name, 0.84).head;
    const withdrawn = cuttingPose(name, 1.08).head;
    assert.ok(withdrawn.x > follow.x + 0.05, name + " withdraws sideways clear of the plant");
    assert.ok(withdrawn.z > 0.30, name + " keeps the axe in front of the legs");
    assert.ok(Math.abs(follow.y - withdrawn.y) < 0.055, name + " avoids scraping down the trunk");
    for (let time = 0; time <= 1.5; time += 0.05) {
      assert.ok(cuttingPose(name, time).head.y > 0.035, name + " keeps the head above the ground at " + time);
    }
  }
});


it("keeps both hands wrapped around separate grips throughout every stroke", () => {
  for (const name of CHOPS) {
    for (let frame = 0; frame <= 180; frame++) {
      const contact = cuttingPose(name, frame / 120);
      assert.ok(contact.supportError < 0.015,
        name + " support hand leaves the shaft at " + frame / 120 + ": " + contact.supportError);
      assert.ok(contact.supportAlong > -0.14 / 1.24 && contact.supportAlong < -0.04,
        name + " support hand overlaps the dominant grip or leaves the butt at " + frame / 120);
      assert.ok(contact.gripErrors.every((error) => error < 0.04),
        name + " handle leaves the fingers at " + frame / 120 + ": " + contact.gripErrors);
      const base = contact.tool.getPosition();
      const shaft = contact.head.clone().sub(base);
      const palms = ["Right", "Left"].map(side => contact.rig.get(`${side} white glove`)
        .getWorldTransform().transformPoint(new Vec3(0, -0.08, 0.095)));
      assert.ok(palms[0].distance(palms[1]) > 0.07, name + " overlaps its gripping fists");
      for (const side of ["Right", "Left"]) {
        for (const finger of ["index", "middle", "ring", "little"]) {
          const knuckle = contact.rig.get(`${side} ${finger} 2`).getPosition().clone().sub(base);
          const along = knuckle.dot(shaft) / shaft.lengthSq();
          assert.ok(along > -0.15 / 1.24 && along < 0.25 / 1.24,
            name + " puts " + side + " " + finger + " beyond the wooden grip");
        }
      }
    }
  }
});

it("keeps the support hand on the shaft while blending into each cutting level", () => {
  for (const name of CHOPS) {
    for (let frame = 0; frame <= 38; frame++) {
      const time = frame / 120;
      const source = pose("SummonAxe", time);
      const destination = pose(name, time);
      const weight = Math.min(1, time / 0.32);
      for (const [nodeName, entity] of source) {
        const target = destination.get(nodeName);
        entity.setLocalPosition(new Vec3().lerp(entity.getLocalPosition(), target.getLocalPosition(), weight));
        entity.setLocalRotation(new Quat().slerp(entity.getLocalRotation(), target.getLocalRotation(), weight));
        entity.setLocalScale(new Vec3().lerp(entity.getLocalScale(), target.getLocalScale(), weight));
      }
      const clearance = name === "ChopLow"
        ? 0.12 * Math.sin(Math.PI * Math.max(0, Math.min(1, (time - 0.14) / 0.18))) ** 2 : 0;
      const contact = cuttingPose(name, time, source, true, clearance);
      assert.ok(contact.supportError < 0.025,
        name + " loses its support grip during the stance blend at " + time + ": " + contact.supportError);
      const rightPalm = source.get("Right white glove").getWorldTransform()
        .transformPoint(new Vec3(0, -0.08, 0.095));
      const direction = contact.head.clone().sub(contact.tool.getPosition()).normalize();
      const rightGrip = contact.tool.getPosition().clone()
        .add(direction.mulScalar(0.08 * HERO_MODEL_SCALE));
      assert.ok(rightPalm.distance(rightGrip) < 0.015,
        name + " loses its right grip while correcting the support hand at " + time);
      if (name === "ChopLow") {
        for (const bodyName of BODY_CLEARANCE_MESHES) {
          const node = gltf.nodes.find(node => node.name === bodyName);
          const primitive = gltf.meshes[node.mesh].primitives[0];
          const bounds = gltf.accessors[primitive.attributes.POSITION];
          const relative = source.get(bodyName).getWorldTransform().clone().invert()
            .mul(contact.tool.getWorldTransform());
          const intersects = axeVertices.some(vertex => {
            const point = relative.transformPoint(vertex);

            return [point.x, point.y, point.z].every((value, axis) =>
              value > bounds.min[axis] + 0.01 && value < bounds.max[axis] - 0.01)
              && insideBodyMesh(point, primitive);
          });
          assert.equal(intersects, false, "low-stance blend intersects " + bodyName + " at " + time);
        }
      }
    }
  }
});

it("returns to the same ready pose without a reset", () => {
  for (const name of CHOPS) {
    const start = cuttingPose(name, 0);
    const end = cuttingPose(name, 1.5);
    assert.ok(start.head.distance(end.head) < 0.003, name + " loops without a pose reset: " + start.head.distance(end.head));

  }
});

it("moves the held axe continuously between adjacent animation frames", () => {
  for (const name of CHOPS) {
    let previous;
    for (let frame = 0; frame <= 90; frame++) {
      const { tool } = cuttingPose(name, frame / 60);
      const rotation = tool.getRotation().clone();
      const position = tool.getPosition().clone();
      if (previous) {
        const dot = Math.abs(rotation.x * previous.rotation.x
          + rotation.y * previous.rotation.y + rotation.z * previous.rotation.z
          + rotation.w * previous.rotation.w);
        const angle = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
        assert.ok(angle < 25, name + " changes axe direction abruptly at " + frame / 60);
        assert.ok(position.distance(previous.position) < 0.16,
          name + " jumps between grip poses at " + frame / 60);
      }
      previous = {
        rotation,
        position,
      };
    }
  }
});

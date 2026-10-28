import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Mat4, Quat, Vec3 } from "playcanvas";

/**
 * @param {string} path
 */
function model(path) {
  const buffer = readFileSync(new URL(path, import.meta.url));
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
  const binaryOffset = 28 + jsonLength;
  const cache = new Map();
  /**
   * @param {number} index
   */
  const samples = (index) => {
    if (cache.has(index)) {
      return cache.get(index);
    }
    const accessor = gltf.accessors[index];
    const view = gltf.bufferViews[accessor.bufferView];
    const count = accessor.type === "MAT4" ? 16 : accessor.type === "VEC4" ? 4 : accessor.type === "VEC3" ? 3 : 1;
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const bytes = accessor.componentType === 5121 ? 1 : accessor.componentType === 5123 ? 2 : 4;
    const read = accessor.componentType === 5121 ? "readUInt8" : accessor.componentType === 5123 ? "readUInt16LE" : "readFloatLE";
    const result = Array.from({ length: accessor.count }, (_, sample) =>
      Array.from({ length: count }, (_, component) =>
        buffer[read](start + sample * (view.byteStride ?? count * bytes) + component * bytes)));
    cache.set(index, result);

    return result;
  };
  /**
   * @param {string} name
   * @param {number} time
   */
  const pose = (name, time) => {
    const nodes = gltf.nodes.map((node) => {
      const entity = new Entity(node.name);
      entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
      entity.setLocalRotation(new Quat(...(node.rotation ?? [0, 0, 0, 1])));
      entity.setLocalScale(...(node.scale ?? [1, 1, 1]));

      return entity;
    });
    gltf.nodes.forEach((node, index) => {
      for (const child of node.children ?? []) {
        nodes[index].addChild(nodes[child]);
      }
    });
    const animation = gltf.animations.find((animation) => animation.name === name);
    assert.ok(animation, `${name} is embedded`);
    for (const channel of animation.channels) {
      if (channel.target.path === "weights") {
        continue;
      }
      const sampler = animation.samplers[channel.sampler];
      const times = samples(sampler.input).flat();
      const values = samples(sampler.output);
      const sampleTime = Math.min(time, times.at(-1));
      let index = times.findIndex((sample) => sample >= sampleTime);
      if (index < 0) {
        index = times.length - 1;
      }
      // Evaluate an exact authored endpoint directly. Slerping almost-identical
      // float32 quaternions at t=1 can retain the preceding sample when their
      // rounded dot product is slightly greater than one.
      const previous = sampleTime === times[index] ? index : Math.max(0, index - 1);
      const amount = index === previous ? 0
        : (sampleTime - times[previous]) / (times[index] - times[previous]);
      const entity = nodes[channel.target.node];
      if (channel.target.path === "rotation") {
        entity.setLocalRotation(new Quat().slerp(new Quat(...values[previous]), new Quat(...values[index]), amount));
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
  };

  return {
    gltf,
    pose,
    samples,
  };
}

it("the special hero's outboard hand skin cannot follow a bending thigh", () => {
  const asset = model("../../../../../src/game/models/hero/variants/special-artojas/special-artojas.glb");
  const skin = asset.gltf.skins[0];
  let examined = 0;
  for (const mesh of asset.gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const positions = asset.samples(primitive.attributes.POSITION);
      const joints = asset.samples(primitive.attributes.JOINTS_0);
      const weights = asset.samples(primitive.attributes.WEIGHTS_0);
      positions.forEach(([x, y, z], index) => {
        // The hands hang outside the trouser silhouette in this bind pose.
        // A few fingertip vertices previously followed leg bones and stretched
        // into long triangles when the recovery bent the thighs.
        if (Math.abs(x) <= 0.48 || Math.abs(x) >= 0.82 || y <= 0.52 || y >= 0.93 || Math.abs(z) >= 0.22) {
          return;
        }
        examined++;
        for (let influence = 0; influence < 4; influence++) {
          if (weights[index][influence] <= 0.00001) {
            continue;
          }
          const name = asset.gltf.nodes[skin.joints[joints[index][influence]]].name;
          assert.ok(!/^(Left|Right) (leg|knee|ankle)$/.test(name),
            `hand vertex ${index} must stay with its glove instead of ${name}`);
        }
      });
    }
  }
  assert.ok(examined > 200, "inspect both complete hand regions");
});

/**
 * @param {ReturnType<typeof model>} asset
 * @param {Map<string, Entity>} pose
 * @param {string} side
 * @param {string} [part]
 */
function bootFloor(asset, pose, side, part = "boot") {
  let floor = Infinity;
  const parents = new Map();
  asset.gltf.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      parents.set(child, index);
    }
  });
  asset.gltf.nodes.forEach((node, index) => {
    if (node.mesh === undefined) {
      return;
    }
    let ancestor = index;
    let rigidBoot = false;
    while (ancestor !== undefined) {
      rigidBoot ||= asset.gltf.nodes[ancestor].name === (part === "hand" ? `${side} white glove` : `${side} rigid boot`);
      ancestor = parents.get(ancestor);
    }
    const skin = node.skin === undefined ? null : asset.gltf.skins[node.skin];
    for (const primitive of asset.gltf.meshes[node.mesh].primitives) {
      const positions = asset.samples(primitive.attributes.POSITION);
      if (rigidBoot) {
        const transform = pose.get(node.name).getWorldTransform();
        for (const position of positions) {
          floor = Math.min(floor, transform.transformPoint(new Vec3(...position)).y);
        }
      } else if (skin) {
        const joints = asset.samples(primitive.attributes.JOINTS_0);
        const weights = asset.samples(primitive.attributes.WEIGHTS_0);
        const inverseBind = asset.samples(skin.inverseBindMatrices).map((matrix) => new Mat4().set(matrix));
        positions.forEach((position, vertex) => {
          if ((part === "boot" && position[1] > 0.5) || (side === "Left" ? position[0] >= 0 : position[0] <= 0)) {
            return;
          }
          const point = new Vec3();
          let bootInfluence = 0;
          for (let influence = 0; influence < 4; influence++) {
            const weight = weights[vertex][influence];
            if (weight < 0.00001) {
              continue;
            }
            const joint = joints[vertex][influence];
            const name = asset.gltf.nodes[skin.joints[joint]].name;
            if (part === "hand" ? name === `${side} white glove` : name === `${side} knee` || name === `${side} ankle`) {
              bootInfluence += weight;
            }
            const local = inverseBind[joint].transformPoint(new Vec3(...position));
            const world = pose.get(name).getWorldTransform().transformPoint(local);
            point.add(world.mulScalar(weight));
          }
          if (bootInfluence > 0.5) {
            floor = Math.min(floor, point.y);
          }
        });
      }
    }
  });

  return floor;
}

for (const [label, path] of [
  ["default hero", "../../../../../src/game/models/hero/hero.glb"],
  ["special hero", "../../../../../src/game/models/hero/variants/special-artojas/special-artojas.glb"],
]) {
  const asset = model(path);
  it(`${label} embeds a finite 2.8-second seated landing, push and sore-backside finish`, () => {
    const clip = asset.gltf.animations.find((clip) => clip.name === "HardLandingRecovery");
    assert.ok(clip);
    const duration = Math.max(...clip.samplers.map((sampler) => asset.samples(sampler.input).at(-1)[0]));
    assert.ok(Math.abs(duration - 2.80) < 0.00001);
    const idle = asset.pose("Idle", 0);
    const standing = asset.pose("HardLandingRecovery", 2.80);
    for (const name of ["Hero animation rig", "Upper body", "Hero head", "Left leg", "Right leg", "Left knee", "Right knee", "Left white glove", "Right white glove"]) {
      const expected = idle.get(name);
      const actual = standing.get(name);
      assert.ok(actual.getPosition().distance(expected.getPosition()) < 0.0001, `${name} final position matches Idle: ${actual.getPosition().distance(expected.getPosition())}`);
      assert.ok(Math.abs(actual.getRotation().dot(expected.getRotation())) > 0.99999, `${name} final rotation matches Idle`);
    }
  });
  it(`${label} lands on its backside with the complete boots extending forward`, () => {
    const idle = asset.pose("Idle", 0);
    const impact = asset.pose("HardLandingRecovery", 0.35);
    for (const side of ["Left", "Right"]) {
      assert.ok(impact.get(`${side} leg`).getPosition().y < 0.34, `${side} hip genuinely sits near the floor`);
      assert.ok(idle.get(`${side} leg`).getPosition().y - impact.get(`${side} leg`).getPosition().y > 0.35,
        `${side} hip descends instead of only bowing the torso`);
      assert.ok(impact.get(`${side} ankle`).getPosition().z - idle.get(`${side} ankle`).getPosition().z > 0.25,
        `${side} boot projects forward in the seated pose`);
      const before = idle.get(`${side} knee`).getPosition().distance(idle.get(`${side} ankle`).getPosition());
      const after = impact.get(`${side} knee`).getPosition().distance(impact.get(`${side} ankle`).getPosition());
      assert.ok(Math.abs(after - before) < 0.00001, `${side} lower leg and whole boot remain rigid`);
      const floor = bootFloor(asset, impact, side);
      assert.ok(floor >= 0.004 && floor < 0.03, `${side} boot stays above the floor without hovering: ${floor}`);
    }
  });
  it(`${label} holds exactly the same seated pose while the bridge is falling`, () => {
    const held = asset.pose("HardLandingRecovery", 0.35);
    for (const time of [0.23, 0.45, 0.60]) {
      const current = asset.pose("HardLandingRecovery", time);
      for (const name of ["Hero animation rig", "Upper body", "Left leg", "Right leg", "Left knee", "Right knee", "Left white glove", "Right white glove"]) {
        const drift = current.get(name).getPosition().distance(held.get(name).getPosition());
        assert.ok(drift < 0.00001, `${name} does not drift during the seated hold at ${time}: ${drift}`);
        assert.ok(Math.abs(current.get(name).getRotation().dot(held.get(name).getRotation())) > 0.99999, `${name} does not rotate during the seated hold`);
      }
    }
  });
  it(`${label} plants a supporting hand as the body rises and extends that arm`, () => {
    const start = asset.pose("HardLandingRecovery", 0.85);
    const finish = asset.pose("HardLandingRecovery", 1.10);
    for (const current of [start, finish]) {
      const floor = bootFloor(asset, current, "Right", "hand");
      assert.ok(floor >= 0.002 && floor < 0.035, `the supporting palm stays on the floor: ${floor}`);
    }
    const firstHand = start.get("Right white glove").getPosition();
    const lastHand = finish.get("Right white glove").getPosition();
    assert.ok(firstHand.distance(lastHand) < 0.001, "the planted hand does not slide during the push");
    const before = start.get("Right arm").getPosition().distance(firstHand);
    const after = finish.get("Right arm").getPosition().distance(lastHand);
    assert.ok(after > before + 0.04, "the supporting arm extends while the body rises over it");
  });
  it(`${label} rubs the rear hip twice after standing`, () => {
    const heights = [];
    for (const time of [1.95, 2.0125, 2.075, 2.1375, 2.20, 2.2625, 2.325, 2.3875, 2.45]) {
      const current = asset.pose("HardLandingRecovery", time);
      const hand = current.get("Right white glove").getPosition();
      const hip = current.get("Right leg").getPosition();
      assert.ok(hand.z < hip.z - 0.04, `the rubbing hand reaches behind the hip at ${time}`);
      assert.ok(Math.abs(hand.y - hip.y) < 0.28, "the rub stays near the backside instead of the upper back");
      heights.push(hand.y);
    }
    assert.ok(Math.max(...heights) - Math.min(...heights) > 0.05, "the sore-backside strokes visibly move the hand");
    assert.ok(heights[1] > heights[3] + 0.035, "the first stroke moves down after reaching up");
    assert.ok(heights[5] > heights[7] + 0.035, "the second stroke repeats the up/down rub");
  });
}

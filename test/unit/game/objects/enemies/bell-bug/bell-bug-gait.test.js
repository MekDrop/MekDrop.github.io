import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const buffer = readFileSync(new URL("../../../../../../src/game/models/enemies/bell-bug/bell-bug.glb", import.meta.url));
const jsonLength = buffer.readUInt32LE(12);
const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
const binaryStart = 28 + jsonLength;

/**
 * @param {number} index
 * @returns {number[][]}
 */
function readAccessor(index) {
  const accessor = document.accessors[index];
  const format = {
    5121: {
      bytes: 1,
      read: offset => buffer.readUInt8(offset),
    },
    5123: {
      bytes: 2,
      read: offset => buffer.readUInt16LE(offset),
    },
    5126: {
      bytes: 4,
      read: offset => buffer.readFloatLE(offset),
    },
  }[accessor.componentType];
  assert.ok(format);
  const view = document.bufferViews[accessor.bufferView];
  const width = accessor.type === "SCALAR" ? 1 : accessor.type === "VEC3" ? 3 : 4;
  const stride = view.byteStride ?? width * format.bytes;

  return Array.from({length: accessor.count}, (_, row) =>
    Array.from({length: width}, (_, column) => format.read(binaryStart +
      (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + row * stride + column * format.bytes)));
}

/**
 * @param {{input:number,output:number}} sampler
 * @param {number} time
 * @returns {number[]}
 */
function sample(sampler, time) {
  const times = readAccessor(sampler.input).map(value => value[0]);
  const values = readAccessor(sampler.output);
  const next = times.findIndex(value => value > time);
  if (next === 0) {
    return values[0];
  }
  if (next === -1) {
    return values.at(-1);
  }
  const alpha = (time - times[next - 1]) / (times[next] - times[next - 1]);

  return values[next].map((value, axis) => values[next - 1][axis] * (1 - alpha) + value * alpha);
}

test("all six rigid feet share one mesh and belong to their own leg bone, without mixed skin weights", () => {
  const legs = document.nodes.filter(node => node.name?.startsWith("BellBug leg "));
  assert.equal(legs.length, 6);
  assert.equal(new Set(legs.map(node => node.mesh)).size, 1);
  for (const leg of legs) {
    assert.equal(leg.skin, undefined, "rigid feet must not blend unrelated leg bones");
    const index = document.nodes.indexOf(leg);
    const parent = document.nodes.find(node => node.children?.includes(index));
    const suffix = leg.name.slice(-2);
    assert.equal(parent.name, `leg_${suffix[0]}_${suffix[1]}`);
    for (const primitive of document.meshes[leg.mesh].primitives) {
      assert.equal(primitive.attributes.JOINTS_0, undefined);
      assert.equal(primitive.attributes.WEIGHTS_0, undefined);
    }
  }
});

test("each hip joint binds the body to its own moving leg without mixed leg influences", () => {
  const hips = document.nodes.filter(node => node.name?.startsWith("BellBug hip joint "));
  assert.equal(hips.length, 6);
  for (const hip of hips) {
    const suffix = hip.name.slice(-2);
    assert.ok(["body", "head"].includes(hip.extras.bodyBone));
    assert.ok(hip.extras.bodyOverlapDepth >= 0.035);
    const expected = new Set([hip.extras.bodyBone, `leg_${suffix[0]}_${suffix[1]}`]);
    const skin = document.skins[hip.skin];
    assert.ok(skin, "the upper joint must stay anchored when the rigid foot steps");
    const bound = new Set();
    const rigidEnds = new Set();
    for (const primitive of document.meshes[hip.mesh].primitives) {
      const joints = readAccessor(primitive.attributes.JOINTS_0);
      const weights = readAccessor(primitive.attributes.WEIGHTS_0);
      for (let vertex = 0; vertex < joints.length; vertex++) {
        assert.ok(Math.abs(weights[vertex].reduce((sum, weight) => sum + weight, 0) - 1) < 0.00002);
        for (let influence = 0; influence < 4; influence++) {
          if (weights[vertex][influence] > 0) {
            const name = document.nodes[skin.joints[joints[vertex][influence]]].name;
            assert.ok(expected.has(name), `${hip.name} must not inherit another leg's movement`);
            bound.add(name);
            if (weights[vertex][influence] > 0.999) {
              rigidEnds.add(name);
            }
          }
        }
      }
    }
    assert.deepEqual(bound, expected);
    assert.deepEqual(rigidEnds, expected, "both attachment ends must follow their respective bone completely");
  }
});

test("walk and run keep at least one tripod planted and preserve every foot's shape", () => {
  for (const name of ["scuttle_walk", "scuttle_run"]) {
    const animation = document.animations.find(clip => clip.name === name);
    const channels = animation.channels.filter(channel => document.nodes[channel.target.node].name?.startsWith("leg_"));
    const translations = channels.filter(channel => channel.target.path === "translation");
    assert.equal(translations.length, 6);
    const duration = Math.max(...animation.samplers.map(sampler => document.accessors[sampler.input].max[0]));
    assert.ok(Math.abs(duration - (name === "scuttle_walk" ? 14 / 30 : 9 / 30)) < 0.00002);
    assert.equal(Math.min(...animation.samplers.map(sampler => document.accessors[sampler.input].min[0])), 0);
    let lifted = 0;
    for (let frame = 0; frame <= 120; frame++) {
      const time = duration * frame / 120;
      let planted = 0;
      for (const channel of translations) {
        const height = sample(animation.samplers[channel.sampler], time)[1];
        const restHeight = document.nodes[channel.target.node].translation[1];
        assert.ok(height >= restHeight - 0.00002, "feet never step below the ground plane");
        if (height <= restHeight + 0.00002) {
          planted++;
        } else {
          lifted++;
        }
      }
      assert.ok(planted >= 3, `${name}: ${planted} planted feet at ${time}`);
    }
    assert.ok(lifted > 30, "swing feet must visibly leave the ground");
    for (const channel of channels.filter(value => value.target.path === "scale")) {
      for (const scale of readAccessor(animation.samplers[channel.sampler].output)) {
        assert.ok(scale.every(value => Math.abs(value - 1) < 0.00002));
      }
    }
    for (const channel of channels.filter(value => value.target.path === "rotation")) {
      const rotations = readAccessor(animation.samplers[channel.sampler].output);
      for (const rotation of rotations) {
        assert.ok(rotation.every((value, index) => Math.abs(value - rotations[0][index]) < 0.00002),
          "foot pads keep a consistent orientation while stepping");
      }
    }
  }
});

test("hiding retracts all six legs and the head, holds the pose, and returns continuously", () => {
  const clips = ["hide_start", "hide_loop", "hide_end"].map(name => document.animations.find(clip => clip.name === name));
  assert.ok(clips.every(Boolean));
  assert.ok(document.nodes.some(node => node.name === "body"));
  const values = (clip, bone, path) => {
    const channel = clip.channels.find(channel => document.nodes[channel.target.node].name === bone && channel.target.path === path);
    assert.ok(channel, `${clip.name} must animate ${bone}.${path}`);

    return readAccessor(clip.samplers[channel.sampler].output);
  };
  const close = (a, b) => a.every((value, axis) => Math.abs(value - b[axis]) < 0.00002);
  for (const bone of ["head", "body", ...["L", "R"].flatMap(side => [0, 1, 2].map(index => `leg_${side}_${index}`))]) {
    const enter = values(clips[0], bone, "translation");
    const hold = values(clips[1], bone, "translation");
    const exit = values(clips[2], bone, "translation");
    assert.ok(enter.at(-1)[1] > enter[0][1] + 0.15, `${bone} withdraws upward inside the shell`);
    assert.ok(hold.every(pose => close(pose, enter.at(-1))), `${bone} remains tucked in`);
    assert.ok(close(exit[0], enter.at(-1)) && close(exit.at(-1), enter[0]), `${bone} emerges without a pose jump`);
    if (bone.startsWith("leg_")) {
      assert.ok((enter.at(-1)[0] - enter[0][0]) * (bone.includes("_R_") ? 1 : -1) < -0.2);
      for (const clip of clips) {
        assert.ok(values(clip, bone, "scale").every(scale => close(scale, [1, 1, 1])), "feet retract without shrinking away");
      }
    }
  }
  for (const clip of clips) {
    const shell = values(clip, "shell", "translation");
    assert.ok(shell.every(pose => close(pose, shell[0])), "the shell remains rigid on its bone");
  }
});

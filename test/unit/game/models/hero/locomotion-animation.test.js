import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Quat, Vec3 } from "playcanvas";
import { HERO_MODEL_SCALE } from "../../../../../src/game/config/character-size.js";

const buffer = readFileSync(new URL(
  "../../../../../src/game/models/hero/hero.glb",
  import.meta.url,
));
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;

/**
 * @param {number} index
 */
function samples(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const count = accessor.type === "VEC4" ? 4 : accessor.type === "VEC3" ? 3 : 1;
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return Array.from({ length: accessor.count }, (_, sample) =>
    Array.from({ length: count }, (_, component) =>
      buffer.readFloatLE(start + sample * (view.byteStride ?? count * 4) + component * 4)));
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
    const times = samples(sampler.input).flat();
    const values = samples(sampler.output);
    const sampleTime = Math.min(time, times.at(-1));
    let index = times.findIndex((sample) => sample >= sampleTime);
    if (index < 0) {
      index = times.length - 1;
    }
    const previous = Math.max(0, index - 1);
    const amount = index === previous ? 0
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

it("Walk stays upright over its supporting leg instead of holding a crouch", () => {
  const standing = pose("Idle", 0);
  const standingHeight = standing.get("Hero animation rig").getLocalPosition().y;
  let totalHeight = 0;
  for (let frame = 0; frame < 120; frame++) {
    const phase = frame / 120;
    const current = pose("Walk", phase * (2 / 3), standing);
    totalHeight += current.get("Hero animation rig").getLocalPosition().y;
    const headDrop = standing.get("Hero head").getPosition().y - current.get("Hero head").getPosition().y;
    assert.ok(headDrop < 0.12, `walking lowers the standing silhouette by ${headDrop}`);
    for (const [side, offset] of [["Left", 0], ["Right", 0.5]]) {
      if ((phase + offset) % 1 >= 0.42) {
        continue;
      }
      const knee = current.get(`${side} knee`).getLocalRotation();
      const bend = 2 * Math.acos(Math.min(1, Math.abs(knee.w))) * 180 / Math.PI;
      assert.ok(bend < 75, `${side} supporting knee crouches ${bend} degrees`);
      assert.ok(Math.abs(current.get(`${side} ankle`).getPosition().y -
        standing.get(`${side} ankle`).getPosition().y) * HERO_MODEL_SCALE < 0.006,
      `${side} planted ankle must remain at the standing ground plane`);
    }
  }
  assert.ok(totalHeight / 120 > standingHeight - 0.12,
    "the pelvis must remain close to standing height on average");
});

for (const [name, duration, stance, reach] of [
  ["Walk", 2 / 3, 0.42, 0.30],
  ["Run", 0.625, 0.30, 0.34],
]) {
  it(`${name} explicitly binds hip offsets and keeps both planted feet at standing height`, () => {
    const standing = pose("Idle", 0);
    const clip = gltf.animations.find(animation => animation.name === name);
    for (const side of ["Left", "Right"]) {
      const node = gltf.nodes.findIndex(node => node.name === `${side} leg`);
      assert.ok(clip.channels.some(channel => channel.target.node === node &&
        channel.target.path === "translation"), `${side} hip offset must not depend on the preceding action`);
    }
    for (let frame = 0; frame < 60; frame++) {
      const phase = frame / 60;
      const current = pose(name, phase * duration, standing);
      for (const [side, offset] of [["Left", 0], ["Right", 0.5]]) {
        if ((phase + offset) % 1 >= stance) {
          continue;
        }
        const groundError = Math.abs(current.get(`${side} ankle`).getPosition().y -
          standing.get(`${side} ankle`).getPosition().y) * HERO_MODEL_SCALE;
        assert.ok(groundError < 0.006,
          `${side} planted ankle deviates ${groundError}m from standing height`);
      }
    }
  });
  it(`${name} plants each boot while bending the knee and clearing the swing foot`, () => {
    const speed = (2 * reach * HERO_MODEL_SCALE) / (duration * stance);
    for (const [side, phase] of [["Left", 0], ["Right", 0.5]]) {
      const start = (phase + stance * 0.15) * duration;
      const end = (phase + stance * 0.8) * duration;
      const first = pose(name, start % duration).get(`${side} ankle`).getPosition();
      const last = pose(name, end % duration).get(`${side} ankle`).getPosition();
      const residual = (last.z - first.z) * HERO_MODEL_SCALE + speed * (end - start);
      assert.ok(Math.abs(residual) < 0.012, `${side} planted boot slides ${residual}m`);
      assert.ok(Math.abs(last.y - first.y) * HERO_MODEL_SCALE < 0.006, `${side} stance bounces`);
      const swing = pose(name, ((phase + stance + (1 - stance) / 2) * duration) % duration);
      assert.ok((swing.get(`${side} ankle`).getPosition().y - first.y) * HERO_MODEL_SCALE > 0.04, `${side} swing foot does not lift`);
      const startKnee = pose(name, start % duration).get(`${side} knee`).getLocalRotation();
      const swingKnee = swing.get(`${side} knee`).getLocalRotation();
      assert.ok(Math.abs(startKnee.dot(swingKnee)) < 0.99, `${side} knee is rigid`);
    }
  });
  it(`${name} loops without a foot or knee discontinuity`, () => {
    const first = pose(name, 0);
    const last = pose(name, duration);
    for (const joint of ["Left ankle", "Right ankle", "Left knee", "Right knee"]) {
      assert.ok(first.get(joint).getPosition().distance(last.get(joint).getPosition()) < 0.002, `${joint} jumps at the loop seam`);
      assert.ok(Math.abs(first.get(joint).getLocalRotation().dot(last.get(joint).getLocalRotation())) > 0.999, `${joint} snaps at the loop seam`);
    }
  });
}

it("Run has a distinct flight phase, forward lean and bent elbows", () => {
  const standing = pose("Idle", 0);
  const walking = pose("Walk", 0, standing);
  const running = pose("Run", 0.4 * 0.625, standing);
  for (const side of ["Left", "Right"]) {
    assert.ok(running.get(`${side} ankle`).getPosition().y > 0.19,
      "running must include both feet visibly airborne");
    assert.ok(Math.abs(running.get(`${side} elbow`).getLocalEulerAngles().x) > 45,
      "running arms must pump with bent elbows");
  }
  assert.ok(running.get("Upper body").getLocalEulerAngles().x >
    walking.get("Upper body").getLocalEulerAngles().x + 10,
  "running must lean forward distinctly from the walking pose");
});

it("both braking clips settle back to the standing torso and feet", () => {
  const standing = pose("Idle", 0);
  for (const name of ["RunStopLeft", "RunStopRight"]) {
    const stopped = pose(name, 0.46, standing);
    assert.ok(stopped.get("Hero head").getPosition().distance(standing.get("Hero head").getPosition()) < 0.03);
    for (const side of ["Left", "Right"]) {
      assert.ok(stopped.get(`${side} ankle`).getPosition().distance(standing.get(`${side} ankle`).getPosition()) < 0.04);
    }
  }
});

it("braking contacts counter the capsule's deceleration instead of skating with it", () => {
  /**
   * @param {number} phase
   */
  const travel = phase => {
    const seconds = Math.min(0.4, phase * 0.42);

    return 3.4 * seconds - 4.25 * seconds * seconds;
  };
  for (const [name, side] of [["RunStopLeft", "Right"], ["RunStopRight", "Left"]]) {
    const start = pose(name, 0.3 * 0.42).get(`${side} ankle`).getPosition();
    const end = pose(name, 0.55 * 0.42).get(`${side} ankle`).getPosition();
    const slip = (end.z - start.z) * HERO_MODEL_SCALE + travel(0.55) - travel(0.3);
    assert.ok(Math.abs(slip) < 0.012, `${name} planted braking foot slides ${slip}m`);
  }
});

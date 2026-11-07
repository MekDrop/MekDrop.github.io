import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Mat4, Quat, Vec3 } from "playcanvas";
import { KING_ANIMATION } from "../../../../../../src/game/enum/KingAnimation.js";

function kingGltf() {
  const buffer = readFileSync(new URL(
    "../../../../../../src/game/models/castle/royals/king.glb",
    import.meta.url,
  ));
  const jsonLength = buffer.readUInt32LE(12);

  return {
    buffer,
    binaryOffset: 20 + jsonLength + 8,
    gltf: JSON.parse(buffer.subarray(20, 20 + jsonLength)),
  };
}

function accessorFloats({ buffer, binaryOffset, gltf }, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = binaryOffset + (view.byteOffset ?? 0) +
    (accessor.byteOffset ?? 0);
  const components = accessor.type === "VEC4" ? 4 : accessor.type === "VEC3" ? 3 : 1;

  return Array.from({ length: accessor.count * components }, (_, index) =>
    buffer.readFloatLE(offset + index * 4));
}

/**
 * Evaluate exported channels, including interpolation between authored frames.
 * @param {ReturnType<typeof kingGltf>} model
 * @param {string} name
 * @param {number} time
 * @returns {Map<string, Mat4>}
 */
function walkingPose(model, name, time) {
  const { gltf } = model;
  const clip = gltf.animations.find((animation) => animation.name === name);
  const transforms = gltf.nodes.map((node) => ({
    translation: node.translation ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0, 1],
    scale: node.scale ?? [1, 1, 1],
  }));
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler];
    const times = accessorFloats(model, sampler.input);
    const values = accessorFloats(model, sampler.output);
    const size = channel.target.path === "rotation" ? 4 : 3;
    const first = Math.max(0, times.findLastIndex((value) => value <= time));
    const second = Math.min(first + 1, times.length - 1);
    const amount = first === second ? 0 : (time - times[first]) / (times[second] - times[first]);
    const a = values.slice(first * size, (first + 1) * size);
    const b = values.slice(second * size, (second + 1) * size);
    transforms[channel.target.node][channel.target.path] = size === 4
      ? new Quat().slerp(new Quat(...a), new Quat(...b), amount).toArray()
      : a.map((value, index) => value + (b[index] - value) * amount);
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

  return new Map(gltf.nodes.map((node, index) => [node.name, world(index)]));
}

it("keeps the drill rear foot planted and returns both feet to the opening guard", () => {
  const model = kingGltf();
  const start = walkingPose(model, "SwordTrainingDrill", 0);
  const rear = start.get("King right foot").getTranslation();
  for (let frame = 0; frame <= 149; frame++) {
    const pose = walkingPose(model, "SwordTrainingDrill", frame / 24);
    assert.ok(pose.get("King right foot").getTranslation().distance(rear) < 0.035,
      `rear-foot drift at frame ${frame}`);
    const head = pose.get("Royal head rig").getTranslation();
    assert.ok(head.y > start.get("Royal head rig").getTranslation().y - 0.1,
      `collapsed training stance at frame ${frame}`);
  }
  const end = walkingPose(model, "SwordTrainingDrill", 479 / 24);
  for (const name of ["King left foot", "King right foot"]) {
    assert.ok(end.get(name).getTranslation().distance(start.get(name).getTranslation()) < 0.001);
  }
});

it("advances three alternating steps and retreats without dragging the support foot", () => {
  const model = kingGltf();
  const start = walkingPose(model, "SwordTrainingDrill", 6.5);
  const steps = [["left", 6.6, 7.2], ["right", 7.4, 8], ["left", 8.2, 8.8],
    ["right", 9.6, 10.2], ["left", 10.4, 11], ["right", 11.2, 11.8]];
  for (const [side, from, to] of steps) {
    const support = `King ${side === "left" ? "right" : "left"} foot`;
    const anchor = walkingPose(model, "SwordTrainingDrill", from).get(support).getTranslation();
    for (let time = from; time <= to; time += 1 / 120) {
      const pose = walkingPose(model, "SwordTrainingDrill", time);
      assert.ok(pose.get(support).getTranslation().distance(anchor) < 0.002,
        `${support} drags at ${time}`);
      assert.ok(pose.get("Royal head rig").getTranslation().y >
        start.get("Royal head rig").getTranslation().y - 0.12, "balanced stepping stance allows knee flexion");
    }
  }
  const advanced = walkingPose(model, "SwordTrainingDrill", 8.8);
  assert.ok(advanced.get("Royal hips").getTranslation().z - start.get("Royal hips").getTranslation().z > 0.6);
  const end = walkingPose(model, "SwordTrainingDrill", 479 / 24);
  for (const name of ["King left foot", "King right foot", "Royal hips"]) {
    assert.ok(end.get(name).getTranslation().distance(start.get(name).getTranslation()) < 0.002,
      `${name} does not return to guard`);
  }
});
it("turns to face behind and completes its full spin while airborne", () => {
  const model = kingGltf();
  const forward = (time) => walkingPose(model, "SwordTrainingDrill", time)
    .get("Royal chest").transformVector(new Vec3(0, 0, 1)).normalize();
  assert.ok(forward(12.4).dot(forward(13.6)) < -0.95, "half turn faces behind");
  assert.ok(forward(12.4).dot(forward(15)) > 0.95, "returns to opening direction");
  for (const [support, from, to] of [["right", 12.65, 13.05], ["left", 13.1, 13.5],
    ["left", 14, 14.4], ["right", 14.45, 14.85]]) {
    const name = `King ${support} foot`;
    const anchor = walkingPose(model, "SwordTrainingDrill", from).get(name).getTranslation();
    for (let time = from; time <= to; time += 1 / 120) {
      assert.ok(walkingPose(model, "SwordTrainingDrill", time).get(name)
        .getTranslation().distance(anchor) < 0.004, `${name} drags during turn at ${time}: ${walkingPose(model, "SwordTrainingDrill", time).get(name).getTranslation().distance(anchor)}`);
    }
  }
  let total = 0;
  let previous = null;
  for (let frame = 0; frame <= 96; frame++) {
    const time = 16.45 + 0.8 * frame / 96;
    const direction = forward(time);
    const angle = Math.atan2(direction.x, direction.z);
    if (previous !== null) {
      total += ((angle - previous + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    }
    previous = angle;
  }
  assert.ok(Math.abs(Math.abs(total) - Math.PI * 2) < 0.06, "full airborne revolution");
  const start = walkingPose(model, "SwordTrainingDrill", 16.4);
  const apex = walkingPose(model, "SwordTrainingDrill", 16.85);
  const end = walkingPose(model, "SwordTrainingDrill", 18);
  for (const name of ["King left foot", "King right foot"]) {
    assert.ok(apex.get(name).getTranslation().y > start.get(name).getTranslation().y + 0.25,
      `${name} leaves the floor`);
    assert.ok(end.get(name).getTranslation().distance(start.get(name).getTranslation()) < 0.002,
      `${name} lands on the original contact`);
  }
});
it("sits low on the ground, keeps the boots supported, and stands back into guard", () => {
  const model = kingGltf();
  const down = walkingPose(model, "GroundSitDown", 1.5);
  const rest = walkingPose(model, "GroundRest", 0);
  const up = walkingPose(model, "GroundStandUp", 1.5);
  const guard = walkingPose(model, "SwordTrainingDrill", 0);
  const hips = rest.get("Royal hips").getTranslation();
  assert.ok(hips.y < 0.2, "pelvis reaches a ground-seated height");
  for (const side of ["left", "right"]) {
    assert.ok(rest.get(`King ${side} foot`).getTranslation().z - hips.z > 0.5,
      `${side} leg extends forward instead of remaining in a squat`);
    assert.ok(rest.get(`Royal ${side} knee`).getTranslation().y < 0.3,
      `${side} knee relaxes below the chest`);
  }
  assert.ok(rest.get("Royal right hand").getTranslation().y < 0.06,
    "supporting palm reaches the ground");
  const blade = rest.get("King sword tip").getTranslation()
    .sub(rest.get("King sword grip").getTranslation()).normalize();
  assert.ok(Math.abs(blade.y) < 0.05, "resting sword lies low across the legs");
  for (const name of ["Royal hips", "Royal chest", "King left foot", "King right foot"]) {
    assert.ok(down.get(name).getTranslation().distance(rest.get(name).getTranslation()) < 0.001,
      `${name} jumps when settling into rest`);
    assert.ok(up.get(name).getTranslation().distance(guard.get(name).getTranslation()) < 0.003,
      `${name} does not return to the opening guard`);
  }
  for (const clip of ["GroundSitDown", "GroundRest", "GroundStandUp"]) {
    const duration = clip === "GroundRest" ? 2.5 : 1.5;
    for (let time = 0; time <= duration; time += 1 / 120) {
      const pose = walkingPose(model, clip, time);
      for (const side of ["left", "right"]) {
        assert.ok(pose.get(`King ${side} foot`).getTranslation().y > 0.055,
          `${clip} pushes a boot through the floor at ${time}`);
      }
    }
  }
});

it("raises, cuts downward, and extends the drill thrust in distinct directions", () => {
  const model = kingGltf();
  const directions = [1.25, 1.62, 3.62].map((time) => {
    const pose = walkingPose(model, "SwordTrainingDrill", time);

    return pose.get("King sword tip").getTranslation()
      .sub(pose.get("King sword grip").getTranslation()).normalize();
  });
  assert.ok(directions[0].y > 0.95, "raised preparation");
  assert.ok(directions[1].y < -0.4 && directions[1].z > 0.7, "downward cut");
  assert.ok(Math.abs(directions[2].y) < 0.1 && directions[2].z > 0.95, "forward thrust");
});
it("keeps the weighted walking sword grounded and attached during support", () => {
  const model = kingGltf();
  for (const name of ["WalkOut", "TerraceWalk"]) {
    const clip = model.gltf.animations.find((animation) => animation.name === name);
    const duration = Math.max(...clip.samplers.flatMap((sampler) => accessorFloats(model, sampler.input)));
    let lifted = false;
    let supportLean = 0;
    for (let sample = 0; sample <= duration * 120; sample++) {
      const time = sample / 120;
      const pose = walkingPose(model, name, time);
      const tip = pose.get("King sword tip").getTranslation();
      const grip = pose.get("King sword grip").getTranslation();
      const hand = pose.get("Royal left hand").getTranslation();
      assert.ok(tip.y >= 0.012, `${name} penetrates the floor at ${time}: ${tip.y}`);
      assert.ok(grip.distance(hand) < 0.00001, `${name} loses its grip at ${time}`);
      if (time % 1 < 0.54) {
        assert.ok(tip.y < 0.025, `${name} floats during support at ${time}`);
        const lean = Math.hypot(grip.x - tip.x, grip.z - tip.z);
        supportLean = Math.max(supportLean, lean);
        assert.ok(lean < 0.14, `${name} leans too far during support`);
      }
      lifted ||= tip.y > 0.1;
    }
    assert.ok(lifted, `${name} drags the sword instead of lifting it`);
    assert.ok(supportLean > 0.07, `${name} holds the loaded sword unnaturally rigid`);
  }
});

it("embeds every terrace animation in the editable king model export", () => {
  const { gltf } = kingGltf();
  const animations = new Map(gltf.animations.map((animation) => [
    animation.name,
    animation,
  ]));
  assert.equal(animations.size, gltf.animations.length, "animation names must remain unique");
  assert.deepEqual([...animations.keys()].sort(),
    [...Object.values(KING_ANIMATION), "RoyalSit", "WalkOut", "Cry"].sort(),
    "importing garment meshes must not add duplicate action variants to the runtime state paths");
  for (const name of Object.values(KING_ANIMATION)) {
    const animation = animations.get(name);
    assert.ok(animation, `missing embedded animation ${name}`);
    const targets = new Set(animation.channels.map((channel) =>
      gltf.nodes[channel.target.node].name));
    for (const target of [
      "Royal animation rig",
      "Royal head rig",
      "Royal left arm rig",
      "Royal right arm rig",
      "Royal left leg rig",
      "Royal right leg rig",
      "Royal left hand",
    ]) {
      assert.ok(targets.has(target), `${name} does not animate ${target}`);
    }
  }
});

it("plants the seated sword ahead of the boots without losing the grip", () => {
  const model = kingGltf();
  for (const time of [0, 0.25, 0.5, 0.75, 1]) {
    const pose = walkingPose(model, "RoyalSit", time);
    const tip = pose.get("King sword tip").getTranslation();
    const grip = pose.get("King sword grip").getTranslation();
    const hand = pose.get("Royal left hand").getTranslation();
    assert.ok(tip.y >= 0.012 && tip.y < 0.025, `seated blade must rest above the floor: ${tip.y}`);
    assert.ok(grip.distance(hand) < 0.00001, "seated hand must retain its sword grip");
    assert.ok(tip.z > hand.z, "seated blade must lean forward away from the boots");
  }
});

it("keeps the training recovery blade above the floor between exported frames", () => {
  const model = kingGltf();
  for (let frame = 0; frame <= 70; frame++) {
    const time = frame / 120;
    const pose = walkingPose(model, "SwordFinish", time);
    const tip = pose.get("King sword tip").getTranslation();
    const hand = pose.get("Royal left hand").getTranslation();
    const grip = pose.get("King sword grip").getTranslation();
    assert.ok(tip.y >= 0.01, `training recovery penetrates the floor at ${time}: ${tip.y}`);
    assert.ok(grip.distance(hand) < 0.00001, "training recovery must retain its grip");
  }
});

it("authors distinct model-stored sword directions for the training poses", () => {
  const model = kingGltf();
  const { gltf } = model;
  const directions = new Set();
  for (const animation of gltf.animations.filter(({ name }) =>
    name.startsWith("Sword"))) {
    const channel = animation.channels.find(({ target }) =>
      gltf.nodes[target.node].name === "Royal left hand" &&
      target.path === "rotation");
    assert.ok(channel, `${animation.name} does not animate the sword grip`);
    const values = accessorFloats(
      model,
      animation.samplers[channel.sampler].output,
    );
    for (let index = 0; index < values.length; index += 4) {
      const length = Math.hypot(...values.slice(index, index + 4));
      assert.ok(Math.abs(length - 1) < 0.0001);
    }
    const sampleCount = values.length / 4;
    const targetOffset = Math.floor((sampleCount - 1) * 0.57) * 4;
    const sign = values[targetOffset + 3] < 0 ? -1 : 1;
    directions.add(values
      .slice(targetOffset, targetOffset + 4)
      .map((value) => (value * sign).toFixed(3))
      .join(","));
  }
  assert.ok(directions.size >= 10, "sword poses reuse too few blade directions");
});

import { KingTrainingClips } from "../../../../../../src/game/objects/castle/rooms/terrace/KingTrainingClips.js";
it("exports independent exercises with matching timings and guard contacts", () => {
  const model = kingGltf();
  const guard = walkingPose(model, "SwordTrainingDrill", 0);
  for (const clip of ["SwordCombination", "AdvanceRetreat", "HalfTurnPractice", "JumpSpin", "GuardPractice"]) {
    const action = model.gltf.animations.find(a => a.name === clip);
    const duration = Math.max(...action.samplers.flatMap(s => accessorFloats(model, s.input)));
    assert.ok(Math.abs(duration - KingTrainingClips.duration(clip)) < 0.00001, clip);
    for (const time of [0, duration]) {
      const pose = walkingPose(model, clip, time);
      for (const name of ["Royal hips", "King left foot", "King right foot", "King sword grip", "King sword tip"]) {
        assert.ok(pose.get(name).getTranslation().distance(guard.get(name).getTranslation()) < 0.015, clip + " " + time + " " + name);
      }
    }
  }
});

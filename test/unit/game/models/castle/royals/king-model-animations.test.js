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

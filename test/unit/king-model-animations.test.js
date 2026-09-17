import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { KING_ANIMATION } from "../../src/game/enum/KingAnimation.js";

function kingGltf() {
  const buffer = readFileSync(new URL(
    "../../src/game/models/castle/royals/king.glb",
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
  const components = accessor.type === "VEC4" ? 4 : 1;
  return Array.from({ length: accessor.count * components }, (_, index) =>
    buffer.readFloatLE(offset + index * 4));
}

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

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
function pose(name, time) {
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
  for (const channel of animation.channels) {
    if (channel.target.path === "weights") {
      continue;
    }
    const sampler = animation.samplers[channel.sampler];
    const times = samples(sampler.input).flat();
    const values = samples(sampler.output);
    let index = times.findIndex((sample) => sample >= time);
    if (index < 0) {
      index = times.length - 1;
    }
    const previous = Math.max(0, index - 1);
    const amount = index === previous ? 0
      : (time - times[previous]) / (times[index] - times[previous]);
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

it("keeps all eight digging contacts and reverses the soil release toward the opposite mound", () => {
  for (let stroke = 0; stroke < 8; stroke++) {
    const contactTime = stroke * 1.6 + 0.6;
    const normalContact = pose("Dig", contactTime);
    const oppositeContact = pose("DigOpposite", contactTime);
    for (const name of ["Right white glove", "Left white glove", "Right ankle", "Left ankle"]) {
      assert.ok(normalContact.get(name).getPosition().distance(oppositeContact.get(name).getPosition()) < 0.001,
        `stroke ${stroke}: ${name} contact changed`);
    }
    const releaseTime = stroke * 1.6 + 1.23;
    const normal = pose("Dig", releaseTime);
    const opposite = pose("DigOpposite", releaseTime);
    const anchor = new Vec3(0, -1.18, 0);
    const normalSoil = normal.get("Right white glove").getWorldTransform().transformPoint(anchor).mulScalar(HERO_MODEL_SCALE);
    const oppositeSoil = opposite.get("Right white glove").getWorldTransform().transformPoint(anchor).mulScalar(HERO_MODEL_SCALE);
    assert.ok(normalSoil.x > 0.2 && oppositeSoil.x < -0.2, `stroke ${stroke}: release must switch sides: ${normalSoil} / ${oppositeSoil}`);
    assert.ok(Math.abs(oppositeSoil.x + normalSoil.x) < 0.01);
    assert.ok(normalSoil.z > 0.535 && oppositeSoil.z < 0.535,
      "release must move from the far side of the hole to its near side");
    for (const name of ["Right ankle", "Left ankle"]) {
      assert.ok(normal.get(name).getPosition().distance(opposite.get(name).getPosition()) < 0.001,
        `stroke ${stroke}: ${name} moved during the throw`);
    }
  }
});

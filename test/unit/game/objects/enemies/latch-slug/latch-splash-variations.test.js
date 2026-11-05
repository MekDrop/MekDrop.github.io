import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { LatchSplashVariations } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSplashVariations.js";
import { latchSplashProfiles } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSplashProfiles.js";

test("every splat cycle uses all authored shapes without adjacent repeats, with independent proportions", () => {
  const choices = new LatchSplashVariations();
  let seed = 19;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed / 4294967296;
  };
  const results = Array.from({ length: 36 }, () => choices.next(1.4, random));
  for (let offset = 0; offset < results.length; offset += 6) {
    assert.equal(new Set(results.slice(offset, offset + 6).map((v) => v.profile.id)).size, 6);
  }
  for (let index = 1; index < results.length; index++) {
    assert.notEqual(results[index].profile.id, results[index - 1].profile.id);
  }
  assert.equal(new Set(results.map((v) => [v.profile.id, v.width, v.height, v.thickness, v.speed].join(","))).size, results.length);
  assert.ok(new Set(results.map((v) => v.profile.drips)).size >= 4);
});

test("every shape reports its initial above-floor ooze landmark", () => {
  for (const contactHeight of [0.7, 0.85, 1, 1.25, 1.5]) {
    for (const extreme of [0, 0.999999]) {
      const choices = new LatchSplashVariations();
      for (let index = 0; index < 6; index++) {
        const choice = choices.next(contactHeight, () => extreme);
        const sample = choice.profile.depthBySecond.find(([time]) => time === choice.stopTime);
        assert.ok(sample[1] * choice.height <= contactHeight - 0.08);
        assert.ok(choice.width >= 0.83 && choice.width <= 1.17);
        assert.ok(choice.thickness >= 0.7 && choice.thickness <= 1.35);
        assert.ok(choice.speed >= 0.78 && choice.speed <= 1.22);
      }
    }
  }
});

test("the GLB supplies each distinct authored node and its matching viscous clip", () => {
  const path = new URL("../../../../../../src/game/models/enemies/latch-slug/latch-slug-splat.glb", import.meta.url);
  const blob = fs.readFileSync(path);
  const asset = JSON.parse(blob.subarray(20, 20 + blob.readUInt32LE(12)).toString());
  assert.equal(asset.meshes.length, 6);
  assert.equal(asset.animations.length, 6);
  for (const profile of latchSplashProfiles) {
    const nodeIndex = asset.nodes.findIndex((node) => node.name === profile.node);
    const animation = asset.animations.find((clip) => clip.name === profile.clip);
    assert.equal(asset.nodes[nodeIndex].extras.dripCount, profile.drips);
    assert.ok(animation.channels.some((channel) => channel.target.node === nodeIndex && channel.target.path === "weights"));
    assert.equal(asset.meshes[asset.nodes[nodeIndex].mesh].primitives[0].targets.length, 5);
    assert.ok(asset.meshes[asset.nodes[nodeIndex].mesh].extras.targetNames.includes("Complete downward runoff"));
  }
});

test("every wall splat is one continuous surface without detached bead islands", () => {
  const blob = fs.readFileSync(new URL("../../../../../../src/game/models/enemies/latch-slug/latch-slug-splat.glb", import.meta.url));
  const jsonLength = blob.readUInt32LE(12);
  const asset = JSON.parse(blob.subarray(20, 20 + jsonLength).toString());
  const binary = blob.subarray(28 + jsonLength);
  const read = (accessorIndex) => {
    const accessor = asset.accessors[accessorIndex];
    const view = asset.bufferViews[accessor.bufferView];
    const width = accessor.type === "VEC3" ? 3 : 1;
    const size = accessor.componentType === 5123 ? 2 : 4;
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);

    return Array.from({ length: accessor.count }, (_, index) =>
      Array.from({ length: width }, (_, axis) => {
        const at = offset + index * (view.byteStride || width * size) + axis * size;

        return accessor.componentType === 5126 ? binary.readFloatLE(at) : size === 2 ? binary.readUInt16LE(at) : binary.readUInt32LE(at);
      }),
    );
  };
  for (const mesh of asset.meshes) {
    assert.equal(mesh.primitives.length, 1);
    const primitive = mesh.primitives[0];
    const positions = read(primitive.attributes.POSITION);
    const indices = read(primitive.indices).flat();
    const parent = positions.map((_, index) => index);
    const root = (index) => {
      while (parent[index] !== index) {
        index = parent[index];
      }

      return index;
    };
    const join = (a, b) => {
      parent[root(a)] = root(b);
    };
    const welded = new Map();
    positions.forEach((position, index) => {
      const key = position.map((value) => value.toFixed(6)).join(",");
      if (welded.has(key)) {
        join(index, welded.get(key));
      } else {
        welded.set(key, index);
      }
    });
    for (let index = 0; index < indices.length; index += 3) {
      join(indices[index], indices[index + 1]);
      join(indices[index], indices[index + 2]);
    }
    assert.equal(new Set(indices.map(root)).size, 1, mesh.name);
  }
});

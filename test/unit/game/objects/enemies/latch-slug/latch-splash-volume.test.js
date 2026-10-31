import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("exported viscous clips redistribute a fixed volume while thinning and narrowing", () => {
  const blob = fs.readFileSync(new URL("../../../../../../src/game/models/enemies/latch-slug/latch-slug-splat.glb", import.meta.url));
  const length = blob.readUInt32LE(12);
  const asset = JSON.parse(blob.subarray(20, 20 + length).toString());
  const binary = blob.subarray(28 + length);
  const read = (index) => {
    const a = asset.accessors[index];
    const view = asset.bufferViews[a.bufferView];
    const width = a.type === "VEC3" ? 3 : 1;
    const size = a.componentType === 5123 ? 2 : 4;

    return Array.from({ length: a.count * width }, (_, n) => {
      const at = (view.byteOffset || 0) + (a.byteOffset || 0) + Math.floor(n / width) * (view.byteStride || width * size) + n % width * size;

      return a.componentType === 5126 ? binary.readFloatLE(at) : size === 2 ? binary.readUInt16LE(at) : binary.readUInt32LE(at);
    });
  };
  for (const clip of asset.animations) {
    const channel = clip.channels.find((c) => c.target.path === "weights");
    const mesh = asset.meshes[asset.nodes[channel.target.node].mesh].primitives[0];
    const sampler = clip.samplers[channel.sampler];
    const times = read(sampler.input);
    const weights = read(sampler.output);
    const basis = read(mesh.attributes.POSITION);
    const targets = mesh.targets.map((target) => read(target.POSITION));
    const indices = read(mesh.indices);
    const sample = (time) => {
      let frame = times.findIndex((t) => t >= time);
      if (frame < 0) {
        frame = times.length - 1;
      }
      const previous = Math.max(0, frame - 1);
      const blend = frame === previous ? 0 : (time - times[previous]) / (times[frame] - times[previous]);
      const w = targets.map((_, i) => weights[previous * targets.length + i] * (1 - blend) + weights[frame * targets.length + i] * blend);
      const positions = basis.map((v, i) => v + targets.reduce((sum, target, j) => sum + target[i] * w[j], 0));
      let volume = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        volume += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
          + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
          + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
      }
      const span = (axis) => {
        const values = positions.filter((_, i) => i % 3 === axis);

        return Math.max(...values) - Math.min(...values);
      };

      return {
        volume: Math.abs(volume / 6),
        width: span(0),
        height: span(1),
        thickness: span(2),
      };
    };
    const initial = sample(0.3), final = sample(20);
    assert.ok(initial.volume > 0.001, clip.name);
    for (const time of [1.05, 2.5, 4, 8, 12, 16, 19.5, 20]) {
      const pose = sample(time);
      assert.ok(Math.abs(pose.volume / initial.volume - 1) < 0.01, clip.name + " at " + time);
    }
    assert.ok(final.height > initial.height * 1.3, clip.name);
    assert.ok(final.thickness < initial.thickness * 0.85, clip.name);
    assert.ok(final.width < initial.width * 0.99, clip.name);
  }
});

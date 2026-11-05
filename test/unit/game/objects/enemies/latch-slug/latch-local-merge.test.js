import assert from "node:assert/strict";
import { it } from "node:test";
import { BoxGeometry } from "playcanvas";
import { LatchCoverage } from "../../../../../../src/game/objects/enemies/latch-slug/LatchCoverage.js";

const patch = (x, y = 0) => {
  const shape = new BoxGeometry();

  return {
    positions: shape.positions.map((v, i) => i % 3 === 0 ? v * 0.8 + x : i % 3 === 1 ? v * 0.8 + y : v * 0.08 + 0.1),
    indices: shape.indices,
    volume: 0.8 * 0.8 * 0.08,
  };
};

it("merges the occupied area of both splats without shrinking either one into an older center", () => {
  const left = patch(-0.3), right = patch(0.3);
  const union = new LatchCoverage([left, right]);
  const occupied = [];
  for (let i = 0; i < union.topIndices.length; i++) {
    const top = union.topIndices[i] * 3, base = union.baseIndices[i] * 3;
    if (union.positions[top + 2] - union.positions[base + 2] > 0.001) {
      occupied.push(union.positions[top]);
    }
  }
  assert.ok(Math.min(...occupied) < -0.65, "the left lobe stays in its impact area");
  assert.ok(Math.max(...occupied) > 0.65, "the right lobe stays in its impact area");
  assert.ok(Math.abs(union.volume - left.volume - right.volume) < 1e-6);
  assert.ok(union.positions.every(Number.isFinite));
  assert.ok(Math.max(...union.positions.filter((_, i) => i % 3 === 2)) < 0.3);
});

it("has no older-patch bias and removes only the expired area's contribution", () => {
  const left = patch(-0.3), right = patch(0.3);
  const forward = new LatchCoverage([left, right]), reverse = new LatchCoverage([right, left]);
  assert.deepEqual(forward.positions, reverse.positions);
  assert.deepEqual(forward.indices, reverse.indices);
  const remaining = new LatchCoverage([right]);
  assert.ok(Math.abs(remaining.volume - right.volume) < 1e-6);
  assert.ok(remaining.positions.every(Number.isFinite));
});

it("keeps previously coalesced lobes joined by wet film as their drip contours separate", () => {
  const upper = patch(0, 0.65), lower = patch(0, -0.65);
  const separate = new LatchCoverage([upper, lower]);
  const merged = new LatchCoverage([upper, lower], true);
  assert.equal(separate.connections, 0, "unrelated, never-touching splats do not gain a bridge");
  assert.equal(merged.connections, 1);
  const wet = [];
  for (let i = 0; i < merged.topIndices.length; i++) {
    const top = merged.topIndices[i] * 3, base = merged.baseIndices[i] * 3;
    if (merged.positions[top + 2] - merged.positions[base + 2] > 0.001) {
      wet.push(merged.positions[top + 1]);
    }
  }
  assert.ok(wet.some(y => Math.abs(y) < 0.02), "the separating gap contains a continuous gel neck");
  assert.ok(Math.abs(merged.volume - upper.volume - lower.volume) < 1e-6, "the neck redistributes existing mass");
  assert.ok(merged.positions.every(Number.isFinite));
  const edges = new Map();
  for (let i = 0; i < merged.indices.length; i += 3) {
    const triangle = merged.indices.slice(i, i + 3);
    for (const a of triangle) {
      const neighbors = edges.get(a) ?? new Set();
      edges.set(a, neighbors);
      for (const b of triangle) {
        neighbors.add(b);
      }
    }
  }
  const visited = new Set(), pending = [merged.indices[0]];
  while (pending.length) {
    const vertex = pending.pop();
    if (visited.has(vertex)) {
      continue;
    }
    visited.add(vertex);
    for (const neighbor of edges.get(vertex)) {
      pending.push(neighbor);
    }
  }
  assert.equal(visited.size, edges.size, "the actual rendered triangle mesh is one connected mass");
  const remaining = new LatchCoverage([upper], true);
  assert.equal(remaining.connections, 0, "a drained or scraped lobe leaves no phantom bridge");
  assert.ok(Math.abs(remaining.volume - upper.volume) < 1e-6);
  const overBrace = new LatchCoverage([upper, lower], true, () => 0.18);
  let supported = false;
  for (let i = 0; i < overBrace.topIndices.length; i++) {
    const top = overBrace.topIndices[i] * 3, base = overBrace.baseIndices[i] * 3;
    if (Math.abs(overBrace.positions[top + 1]) < 0.02 && overBrace.positions[top + 2] > overBrace.positions[base + 2] + 0.001) {
      assert.ok(overBrace.positions[base + 2] >= 0.18 - 1e-6, "connecting film stays above raised door hardware");
      supported = true;
    }
  }
  assert.equal(supported, true);
  assert.ok(Math.abs(overBrace.volume - upper.volume - lower.volume) < 1e-6);
});

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

it("does not turn overlapping dry support sheets at different depths into gel", () => {
  const left = patch(-0.15), right = patch(0.15);
  for (const [index, shape] of [left, right].entries()) {
    const offset = shape.positions.length / 3;
    // Dry film triangles can survive at the visible contour. Each is flat,
    // but separate impacts sample the hardware at slightly different depths.
    shape.positions.push(-1, -1, index * 0.02, 1, -1, index * 0.02,
      1, 1, index * 0.02, -1, 1, index * 0.02);
    shape.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  const union = new LatchCoverage([left, right]);
  const xs = union.indices.map(index => union.positions[index * 3]);
  const ys = union.indices.map(index => union.positions[index * 3 + 1]);
  assert.ok(Math.max(...xs) < 0.6 && Math.min(...xs) > -0.6,
    "only independently wet patch samples enter the merged footprint");
  assert.ok(Math.max(...ys) < 0.45 && Math.min(...ys) > -0.45);
  assert.ok(Math.abs(union.volume - left.volume - right.volume) < 1e-6);
});

it("redistributes merged mass instead of amplifying a thin corner into a long spike", () => {
  const shape = new BoxGeometry();
  const positions = shape.positions.map((value, index) => {
    if (index % 3 !== 2) {
      return value;
    }

    return value > 0 ? 1e-8 + 0.005 * (shape.positions[index - 2] + 0.5) * (shape.positions[index - 1] + 0.5) : 0;
  });
  const union = new LatchCoverage([{
    positions,
    indices: shape.indices,
    volume: 0.04,
  }]);
  const thicknesses = union.topIndices.map((top, index) => union.positions[top * 3 + 2] - union.positions[union.baseIndices[index] * 3 + 2]);

  assert.ok(Math.abs(union.volume - 0.04) < 1e-8);
  assert.ok(Math.max(...thicknesses) <= 0.12 + 1e-8);
  assert.ok(union.positions.every(Number.isFinite));
});

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

it("adds new gel at the impact instead of thickening the entire older splat equally", () => {
  const left = patch(-0.3), right = patch(0.3);
  const one = new LatchCoverage([left]), both = new LatchCoverage([left, right]);
  const depthAt = (coverage, x) => {
    let distance = Infinity, depth = 0;
    for (let i = 0; i < coverage.topIndices.length; i++) {
      const top = coverage.topIndices[i] * 3, base = coverage.baseIndices[i] * 3;
      const candidate = Math.hypot(coverage.positions[top] - x, coverage.positions[top + 1]);
      if (candidate < distance) {
        distance = candidate;
        depth = coverage.positions[top + 2] - coverage.positions[base + 2];
      }
    }

    return depth;
  };
  const oldLobe = depthAt(both, -0.5), overlap = depthAt(both, 0);
  assert.ok(overlap > oldLobe * 1.5, "overlap retains both local contributions");
  assert.ok(Math.abs(oldLobe - depthAt(one, -0.5)) < 0.02, "distant older gel does not get the new impact's mass");
  assert.ok(Math.abs(both.volume - left.volume - right.volume) < 1e-6);
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
  const upper = patch(0, 0.425), lower = patch(0, -0.425);
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

it("does not reconstruct a gel bridge across unsupported masonry", () => {
  const left = patch(-0.6), right = patch(0.6);
  const union = new LatchCoverage([left, right], true, (x) => Math.abs(x) < 0.1 ? null : 0.06);
  assert.equal(union.connections, 0);
  for (let i = 0; i < union.topIndices.length; i++) {
    const top = union.topIndices[i] * 3, base = union.baseIndices[i] * 3;
    if (Math.abs(union.positions[top]) < 0.08) {
      assert.ok(union.positions[top + 2] - union.positions[base + 2] < 1e-8,
        "unsupported space receives no connecting film");
    }
  }
});

it("does not invent a long neck between separated gel patches", () => {
  const upper = patch(0, 0.65), lower = patch(0, -0.65);
  const union = new LatchCoverage([upper, lower], true, () => 0.06);
  assert.equal(union.connections, 0);
  for (let i = 0; i < union.topIndices.length; i++) {
    const top = union.topIndices[i] * 3, base = union.baseIndices[i] * 3;
    if (Math.abs(union.positions[top + 1]) < 0.15) {
      assert.ok(union.positions[top + 2] - union.positions[base + 2] < 1e-8,
        "dry space between distant patches stays dry");
    }
  }
});

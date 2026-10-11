import assert from "node:assert/strict";
import { it } from "node:test";
import { calculateNormals } from "playcanvas";
import { GrassEdgeMesh } from "../../../../../src/game/objects/ground-cover/GrassEdgeMesh.js";

it("builds a closed turf volume with finite outward normals", () => {
  class Mesh {
    setPositions(values) { this.positions = values; }
    setNormals(values) { this.normals = values; }
    setIndices(values) { this.indices = values; }
    update() {}
  }
  const mesh = GrassEdgeMesh.create({ Mesh, calculateNormals, PRIMITIVE_TRIANGLES: 4 }, null);
  assert.ok(mesh.normals.every(Number.isFinite));
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const triangle = mesh.indices.slice(i, i + 3);
    for (let side = 0; side < 3; side += 1) {
      const a = triangle[side];
      const b = triangle[(side + 1) % 3];
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2));
  const top = mesh.normals.slice(0, 3);
  assert.ok(top[1] > 0);
  const ys = mesh.positions.filter((_, index) => index % 3 === 1);
  assert.ok(Math.min(...ys) < -0.08 && Math.max(...ys) > 0);
  // Identical end profiles let consecutive strips meet without overlaps or gaps.
  for (let ring = 0; ring < 5; ring += 1) {
    const first = ring * 3;
    const last = (16 * 5 + ring) * 3;
    assert.deepEqual(mesh.positions.slice(first + 1, first + 3),
      mesh.positions.slice(last + 1, last + 3));
  }
  for (let segment = 1; segment < 16; segment += 1) {
    for (const ring of [2, 3]) {
      const vertex = (segment * 5 + ring) * 3;
      assert.ok(0.49 + mesh.positions[vertex + 2] >= 0.501);
    }
  }
});

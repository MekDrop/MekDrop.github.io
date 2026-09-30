import assert from "node:assert/strict";
import { it } from "node:test";
import { ExcavatedSurface } from "../../../../../src/game/rendering/terrain/ExcavatedSurface.js";

it("keeps all four tile boundaries and upward faces around the open cavity", () => {
  const mesh = {
    setPositions(value) { this.positions = value; }, setNormals() {}, setUvs() {},
    setIndices(value) { this.indices = value; }, update() {},
  };
  ExcavatedSurface.updateMesh(mesh, 0.5, 0.31);
  for (let index = 0; index < mesh.positions.length; index += 6) {
    assert.ok(Math.abs(Math.hypot(mesh.positions[index], mesh.positions[index + 2]) - 0.31) < 1e-6);
    assert.ok(Math.abs(Math.max(Math.abs(mesh.positions[index + 3]), Math.abs(mesh.positions[index + 5])) - 0.5) < 1e-6);
  }
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const [a, b, c] = mesh.indices.slice(index, index + 3).map((vertex) => mesh.positions.slice(vertex * 3, vertex * 3 + 3));
    const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    assert.ok(normalY > 0);
  }
});

import { readFileSync } from "node:fs";
import { FILLED_EARTH_OUTLINE } from "../../../../../src/game/objects/treasure/FilledEarthOutline.js";
import assert from "node:assert/strict";
import { it } from "node:test";
import { ExcavatedSurface } from "../../../../../src/game/rendering/terrain/ExcavatedSurface.js";

it("keeps all four tile boundaries and upward faces around the open cavity", () => {
  const mesh = {
    setPositions(value) {
      this.positions = value;
    },
    setNormals: () => {},
    setUvs: () => {},
    setIndices(value) {
      this.indices = value;
    },
    update: () => {},
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

it("fills the cube cap flush with its perimeter without raised or vertical faces", () => {
  const mesh = {
    positions: [],
    indices: [],
    setPositions: (value) => {
      mesh.positions = value;
    },
    setNormals: () => {},
    setUvs: () => {},
    setIndices: (value) => {
      mesh.indices = value;
    },
    update: () => {},
  };
  for (const depth of [-0.15, 0]) {
    ExcavatedSurface.updateMesh(mesh, 0.5, 0.31, depth);
    assert.equal(mesh.indices.length, 40 * 9, "the open cap gains forty fill triangles");
    assert.ok(mesh.positions.every((value, index) => index % 3 !== 1 || value === 0 || value === depth));
    const fillIndices = mesh.indices.slice(40 * 6);
    let area = 0;
    for (let index = 0; index < fillIndices.length; index += 3) {
      const [a, b, c] = fillIndices.slice(index, index + 3).map((vertex) => mesh.positions.slice(vertex * 3, vertex * 3 + 3));
      assert.equal(a[1], depth);
      assert.equal(b[1], depth);
      assert.equal(c[1], depth);
      const twiceArea = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      assert.ok(twiceArea > 0, "soil triangles face upward");
      area += twiceArea / 2;
    }
    assert.ok(area > Math.PI * 0.31 ** 2 * 0.99, "the fill closes the entire opening");
    ExcavatedSurface.updateMesh(mesh, 0.5, 0.31, depth, true);
    assert.equal(mesh.indices.length, 40 * 3, "the soil material receives only the fill face");
    assert.ok(mesh.positions.every((value, index) => index % 3 !== 1 || value === depth));
  }
});

it("retains the original filled-earth asset outline at ground level", () => {
  const asset = readFileSync(new URL("../../../../../src/game/models/treasure/filled-earth.glb", import.meta.url));
  const length = asset.readUInt32LE(12);
  const document = JSON.parse(asset.subarray(20, 20 + length));
  const accessor = document.accessors[document.meshes[0].primitives[0].attributes.POSITION];
  const view = document.bufferViews[accessor.bufferView];
  const offset = 28 + length + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const mesh = {
    positions: [],
    setPositions: (value) => {
      mesh.positions = value;
    },
    setNormals: () => {},
    setUvs: () => {},
    setIndices: () => {},
    update: () => {},
  };
  ExcavatedSurface.updateMesh(mesh, 0.5, 0.324, 0, true, FILLED_EARTH_OUTLINE);
  for (let index = 0; index < accessor.count; index += 1) {
    const x = asset.readFloatLE(offset + index * 12);
    const z = asset.readFloatLE(offset + index * 12 + 8);
    const matches = (_, vertex) => vertex % 3 === 0 &&
      Math.abs(mesh.positions[vertex] - x) < 1e-6 && Math.abs(mesh.positions[vertex + 2] - z) < 1e-6;
    assert.ok(mesh.positions.some(matches), "each original projected vertex remains in the terrain fill");
  }
  assert.ok(mesh.positions.every((value, index) => index % 3 !== 1 || value === 0), "all soil lies on the cube top");
});

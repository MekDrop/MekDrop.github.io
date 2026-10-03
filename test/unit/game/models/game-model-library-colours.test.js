import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Color, Mat4, Vec3 } from "playcanvas";

const source = readFileSync(new URL("../../../../src/game/models/GameModelLibrary.js", import.meta.url), "utf8");
const start = source.indexOf("  #mergeRenderHierarchy(");
const method = source.slice(start, source.lastIndexOf("}")).replace("#mergeRenderHierarchy", "merge");
const Library = new Function(`return class {
  #pc; #app;
  constructor(pc) { this.#pc = pc; this.#app = { graphicsDevice: {} }; }
  ${method}
}`)();

/**
 * @param {boolean} linearVertexColors
 * @param {number} translationY
 */
function bakedColours(linearVertexColors, translationY = 0) {
  class Mesh {
    setPositions(value) { this.positions = value; } setNormals() {} setUvs() {} setIndices() {}
    setColors32(value) { this.colors = value; }
    update() {} incRefCount() {}
  }
  class Material { update() {} }
  const pc = { Color, Mat4, Vec3, Mesh, StandardMaterial: Material, math: { clamp: (n, min, max) => Math.min(max, Math.max(min, n)) } };
  const transform = new Mat4().setTranslate(0, translationY, 0);
  const mesh = {
    vertexBuffer: { numVertices: 3 }, primitive: [{ indexed: false, base: 0, count: 3 }],
    getPositions(out) { out.push(0, 0, 0, 1, 0, 0, 0, 1, 0); return 3; },
    getNormals(out) { out.push(0, 0, 1, 0, 0, 1, 0, 0, 1); },
    getUvs(_channel, out) { out.push(0, 0, 1, 0, 0, 1); },
    getIndices() {},
  };
  const diffuse = new Color(17 / 255, 23 / 255, 25 / 255).gamma();
  const root = { children: [], getWorldTransform: () => transform, destroy() {}, render: { meshInstances: [{ mesh, node: { getWorldTransform: () => transform }, material: { diffuse, opacity: 1 } }] } };
  const result = new Library(pc).merge({ instantiateRenderEntity: () => root }, linearVertexColors);
  return translationY ? result.mesh.positions : result.mesh.colors.slice(0, 4);
}

it("preserves glTF gate brick colours when baking castle vertex colours", () => {
  assert.deepEqual(bakedColours(true), [17, 23, 25, 255]);
});

it("retains the existing colour encoding for callers that do not opt in", () => {
  const expected = new Color(17 / 255, 23 / 255, 25 / 255).gamma();
  assert.deepEqual(bakedColours(false), [Math.round(expected.r * 255), Math.round(expected.g * 255), Math.round(expected.b * 255), 255]);
});
it("preserves the authored root offset when merging a single-node masonry model", () => {
  assert.deepEqual(bakedColours(false, 0.5), [0, 0.5, 0, 1, 0.5, 0, 0, 1.5, 0]);
});

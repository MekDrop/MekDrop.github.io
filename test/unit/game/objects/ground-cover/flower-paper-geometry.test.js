import assert from "node:assert/strict";
import { it } from "node:test";
import { splitPaperGeometry } from "../../../../../src/game/objects/ground-cover/FlowerPaperGeometry.js";

it("splits paper triangles at their fold without bridging or losing area", () => {
  const geometry = splitPaperGeometry([0, 0, -1, 2, 0, -1, 2, 0, 1, 0, 0, 1],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3], 2);
  let area = 0;
  for (let index = 0; index < geometry.indices.length; index += 3) {
    const indices = geometry.indices.slice(index, index + 3);
    const sections = indices.map(
      /**
       * @param {number} vertex
       */
      (vertex) => geometry.sections[vertex],
    );
    assert.ok(sections.every(
      /**
       * @param {number} section
       */
      (section) => section === sections[0],
    ), "no triangle may bridge independently rotating sections");
    const vertices = indices.map(
      /**
       * @param {number} vertex
       */
      (vertex) => geometry.positions.slice(vertex * 3, vertex * 3 + 3),
    );
    const [a, b, c] = vertices;
    area += Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2;
  }
  assert.ok(Math.abs(area - 4) < 1e-6);
  assert.ok(geometry.positions.includes(1), "both sections must include the shared fold edge");
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { createSpiralStairCollision } from "../../../../../src/game/objects/shared/SpiralStairCollision.js";

it("keeps the spiral walking lane gently sloped and its final tread level", () => {
  class Mesh {
    setPositions(values) { this.positions = values; }
    setIndices(values) { this.indices = values; }
    update() {}
  }
  class MeshInstance {
    constructor(mesh) { this.mesh = mesh; }
  }
  const pc = { Mesh, MeshInstance, GraphNode: class {}, PRIMITIVE_TRIANGLES: 4 };
  const { mesh } = createSpiralStairCollision(pc, {
    innerRadius: 1.5 * 0.08 / 0.65, outerRadius: 1.5 * 0.59 / 0.65,
    rise: 3, turns: 1.5, steps: 24,
  });
  assert.equal(mesh.positions[1], 0, "stair entry begins at floor level without a raised collision lip");
  const point = (index) => mesh.positions.slice(index * 3, index * 3 + 3);
  let laneTriangles = 0;
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const [a, b, c] = mesh.indices.slice(index, index + 3).map(point);
    const ab = b.map((value, axis) => value - a[axis]);
    const ac = c.map((value, axis) => value - a[axis]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (normal[1] <= 0) continue;
    const radius = Math.hypot((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3);
    if (radius < 0.55 || radius > 1) continue;
    assert.ok(normal[1] / Math.hypot(...normal) > 0.8, "triangulation introduces no steep diagonal ridge in the walking lane");
    laneTriangles++;
  }
  assert.ok(laneTriangles > 100);
  const highest = Math.max(...mesh.positions.filter((_, index) => index % 3 === 1));
  assert.equal(highest, 3);
  const finalTop = mesh.positions.slice(-102, -51).filter((_, index) => index % 3 === 1);
  assert.ok(finalTop.every((height) => height === 3), "final tread joins the upper floor at its exact elevation");
});

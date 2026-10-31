import assert from "node:assert/strict";
import { test } from "node:test";
import { LatchDoorSurface } from "../../../../../../src/game/objects/enemies/latch-slug/LatchDoorSurface.js";
import { bodyToGel, gelVolume } from "../../../../../../src/game/objects/enemies/latch-slug/LatchImpactShape.js";

function quad(field, left, bottom, right, top, height) {
  field.addTriangle([left, bottom, height], [right, bottom, height], [right, top, height]);
  field.addTriangle([left, bottom, height], [right, top, height], [left, top, height]);
}

test("moving gel follows the real surface and spends travel crossing raised hardware", () => {
  const flat = new LatchDoorSurface(2, 192);
  quad(flat, -1, -1, 1, 1, 0);
  flat.finish();
  assert.ok(Math.abs(flat.flow(0, 0.7, -0.4) + 0.4) < 0.002);
  const raised = new LatchDoorSurface(2, 192);
  quad(raised, -1, -1, 1, 1, 0);
  quad(raised, -0.4, -0.1, 0.4, 0.15, 0.16);
  raised.finish();
  raised.baseline = 0;
  assert.ok(raised.height(0, 0) > 0.15);
  assert.ok(Math.abs(raised.height(0, 0.5)) < 0.001);
  assert.ok(raised.flow(0, 0.7, -0.4) > flat.flow(0, 0.7, -0.4) + 0.1);
  assert.ok(Math.abs(raised.flow(0.8, 0.7, -0.4) + 0.4) < 0.002);
  assert.ok(raised.height(0, raised.flow(0, 0.7, 0)) > 0.1);
});

test("impact topology starts from the supplied 3D body, away from the wall plane", () => {
  const vertices = [-0.2, -0.3, 0.4, 0.2, -0.3, 0.4, 0.2, 0.3, 0.4, -0.2, 0.3, 0.4,
    -0.2, -0.3, 0.8, 0.2, -0.3, 0.8, 0.2, 0.3, 0.8, -0.2, 0.3, 0.8];
  const indices = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    triangles.push(indices.slice(i, i + 3).flatMap((index) => vertices.slice(index * 3, index * 3 + 3)));
  }
  const target = [0, 0, 0.05, 0.5, 0, 0.01, 0, 0.5, 0.01, -0.5, 0, 0.01, 0, -0.5, 0.01,
    0, 0, -0.01, 0.5, 0, -0.01, 0, 0.5, -0.01, -0.5, 0, -0.01, 0, -0.5, -0.01];
  const result = bodyToGel(target, triangles);
  for (let i = 2; i < result.length; i += 3) {
    assert.ok(result[i] >= 0.399 && result[i] <= 0.801);
  }
  assert.ok(Math.abs(result[2] - 0.8) < 0.001);
  assert.ok(Math.abs(result[17] - 0.4) < 0.001);
  assert.ok(Math.abs(gelVolume(vertices, indices) - 0.096) < 0.00001);
});

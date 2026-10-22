import assert from "node:assert/strict";
import { it } from "node:test";
import { projectIsometricMovement } from "../../../../../../src/game/objects/characters/hero/projectIsometricMovement.js";

it("retains the four cardinal bindings and gives diagonal keys distinct headings", () => {
  const headings = new Set();
  for (const [x, y] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
    const result = projectIsometricMovement(x, y, 0);
    assert.ok(Math.abs(result.length() - 1) < 1e-10);
    headings.add(Math.atan2(result.x, result.y).toFixed(5));
  }
  assert.equal(headings.size, 8);
  assert.equal(projectIsometricMovement(0, -1, 0).x, 1);
  assert.equal(projectIsometricMovement(1, 0, 0).y, -1);
});

it("preserves analog strength and rotates with the camera without axis snapping", () => {
  for (const rotation of [0, 0.25, 1, 2, 3]) {
    const result = projectIsometricMovement(0.2, -0.4, rotation);
    assert.ok(Math.abs(result.length() - Math.hypot(0.2, 0.4)) < 1e-10);
  }
  const result = projectIsometricMovement(0, -1, 1);
  assert.ok(Math.abs(result.x) < 1e-10);
  assert.ok(Math.abs(result.y + 1) < 1e-10);
});

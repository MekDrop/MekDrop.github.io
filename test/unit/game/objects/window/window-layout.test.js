import assert from "node:assert/strict";
import { test } from "node:test";
import { WindowLayout } from "../../../../../src/game/objects/window/WindowLayout.js";

test("window corners preserve bounds, orientation and reversed endpoints", () => {
  for (const alongX of [true, false]) {
    for (const facing of [1, -1]) {
      const from = { x: 2, y: 3, z: 4 };
      const to = { x: alongX ? 7 : 2, y: 5, z: alongX ? 4 : 9 };
      const bounds = WindowLayout.bounds({ id: "window", from, to, facing });
      assert.deepEqual(bounds, WindowLayout.bounds({ id: "window", from: to, to: from, facing }));
      assert.deepEqual(bounds.position, { x: alongX ? 4.5 : 2, y: 3, z: alongX ? 4 : 6.5 });
      assert.equal(bounds.width, 5);
      assert.equal(bounds.height, 2);
      assert.equal(bounds.yaw, alongX ? (facing === 1 ? 0 : 180) : (facing === 1 ? 90 : -90));
    }
  }
});

test("level endpoints accept an explicit window height", () => {
  const bounds = WindowLayout.bounds({ from: { x: 0, y: 2, z: 0 }, to: { x: 1, y: 2, z: 0 }, height: 3, depth: 0.5, variant: "hall" });
  assert.equal(bounds.height, 3);
  assert.equal(bounds.depth, 0.5);
  assert.equal(bounds.role, "hall");
});

test("invalid window ranges fail before rendering", () => {
  const from = { x: 0, y: 0, z: 0 };
  const to = { x: 1, y: 2, z: 0 };
  for (const definition of [
    {}, { from, to: from }, { from, to: { x: 1, y: 2, z: 1 } },
    { from, to, depth: 0 }, { from, to, facing: 0 },
    { from, to: { x: Infinity, y: 2, z: 0 } },
  ]) {
    assert.throws(() => WindowLayout.bounds({ id: "invalid", ...definition }), { name: "InvalidWindowRangeError" });
  }
});

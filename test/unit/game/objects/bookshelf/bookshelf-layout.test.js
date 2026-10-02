import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BookshelfLayout } from "../../../../../src/game/objects/bookshelf/BookshelfLayout.js";

test("shelf ranges preserve edges and fixed depth in both directions on both axes", () => {
  for (const facing of [1, -1]) {
    for (const reverse of [false, true]) {
      for (const alongX of [true, false]) {
        const start = { x: 2, y: 3, z: 4 };
        const end = { x: alongX ? 7 : 2, y: 3, z: alongX ? 4 : 9 };
        const bounds = BookshelfLayout.bounds({ id: "shelf", from: reverse ? end : start, to: reverse ? start : end, height: 2.7, facing });
        assert.equal(bounds.length, 5);
        assert.ok(Math.abs(bounds.y - bounds.height / 2 - 3) < 1e-12);
        assert.equal(alongX ? bounds.depth : bounds.width, 0.36);
        assert.equal(alongX ? bounds.x - bounds.width / 2 : bounds.z - bounds.depth / 2, alongX ? 2 : 4);
        assert.equal(alongX ? bounds.x + bounds.width / 2 : bounds.z + bounds.depth / 2, alongX ? 7 : 9);
        assert.equal(bounds.rotation, alongX ? (facing === 1 ? 0 : 180) : (facing === 1 ? 90 : -90));
      }
    }
  }
});

test("invalid shelf extents fail before rendering", () => {
  const from = { x: 0, y: 2, z: 0 };
  for (const definition of [
    { from, to: from },
    { from, to: { x: 1, y: 2, z: 1 } },
    { from, to: { x: 1, y: 3, z: 0 } },
    { from, to: { x: Infinity, y: 2, z: 0 } },
    { from, to: { x: 1, y: 2, z: 0 }, height: 0 },
    { from, to: { x: 1, y: 2, z: 0 }, facing: 0 },
  ]) {
    assert.throws(() => BookshelfLayout.bounds({ id: "invalid", ...definition }), { name: "InvalidBookshelfRangeError" });
  }
});

test("demonstration map covers both axes and facing directions", () => {
  const map = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/bookshelf.json", import.meta.url), "utf8"));
  assert.equal(map.mapName, "test_bookshelf");
  assert.equal(map.objects.length, 7);
  const rotations = new Set(map.objects.map((definition) => BookshelfLayout.bounds(definition).rotation));
  assert.deepEqual([...rotations].sort((a, b) => a - b), [-90, 0, 90, 180]);
});

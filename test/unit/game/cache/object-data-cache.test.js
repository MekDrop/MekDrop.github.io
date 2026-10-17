import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";
import { mergeCollisionVoxels } from "../../../../src/game/objects/shared/MergeCollisionVoxels.js";
import { BookMapObjects } from "../../../../src/game/objects/castle-props/book/BookMapObjects.js";
import { ShelfBooks } from "../../../../src/game/objects/castle-props/shelf/ShelfBooks.js";
import { BowlPacking } from "../../../../src/game/objects/castle-props/bowl/BowlPacking.js";
import { RoofCollisionLayout } from "../../../../src/game/objects/castle/structure/RoofCollisionLayout.js";
import { SpiralStaircaseLayout } from "../../../../src/game/objects/architecture/spiral-staircase/SpiralStaircaseLayout.js";

const original = ObjectDataCache.data;
afterEach(() => {
  ObjectDataCache.finishRecording();
  ObjectDataCache.data = original;
});

test("a disk round trip bypasses generation and isolates mutable consumers", () => {
  ObjectDataCache.beginRecording();
  const input = {
    seed: "a",
    dimensions: [1, 2],
  };
  const expected = ObjectDataCache.resolve("test", input, () => [{ height: 3 }]);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  const forbidden = () => assert.fail("generator executed on cache hit");
  const actual = ObjectDataCache.resolve("test", {
    dimensions: [1, 2],
    seed: "a",
  }, forbidden);
  assert.deepEqual(actual, expected);
  actual[0].height = 99;
  assert.deepEqual(ObjectDataCache.resolve("test", input, forbidden), expected);
  assert.equal(ObjectDataCache.resolve("test", { seed: "different" }, () => 42), 42);
});

test("vegetation damage shapes and stair layouts retain exact generated data", () => {
  const cells = [{
    x: 0,
    y: 0,
    z: 0,
  }, {
    x: 0,
    y: 1,
    z: 0,
  }];
  const definition = {
    Z1: 1.2,
    Z2: 4.4,
    stepProfile: "castle",
    rotation: 90,
  };
  ObjectDataCache.beginRecording();
  const boxes = mergeCollisionVoxels(cells);
  const steps = SpiralStaircaseLayout.steps(definition);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  assert.deepEqual(mergeCollisionVoxels(cells), boxes);
  assert.deepEqual(SpiralStaircaseLayout.steps(definition), steps);
  assert.throws(() => SpiralStaircaseLayout.steps({
    ...definition,
    Z2: 0,
  }));
});

test("cached books skip packing while adapting IDs, location, and facing", () => {
  const shelf = {
    id: "first",
    seed: "catalog-seed",
    from: {
      x: 0,
      y: 0,
      z: 0,
    },
    to: {
      x: 0.935,
      y: 0,
      z: 0,
    },
    height: 1.8,
  };
  ObjectDataCache.beginRecording();
  const expected = BookMapObjects.forShelf(shelf);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  const layout = ShelfBooks.layout;
  ShelfBooks.layout = () => assert.fail("book packing executed on hit");
  try {
    assert.deepEqual(BookMapObjects.forShelf(shelf), expected);
    const moved = BookMapObjects.forShelf({
      ...shelf,
      id: "second",
      from: {
        x: 10,
        y: 2,
        z: 0,
      },
      to: {
        x: 10.935,
        y: 2,
        z: 0,
      },
    });
    assert.equal(moved.length, expected.length);
    assert.equal(moved[0].sourceShelfId, "second");
    assert.ok(Math.abs(moved[0].position.x - expected[0].position.x - 10) < 1e-10);
  } finally {
    ShelfBooks.layout = layout;
  }
});

test("bowl cache returns Engine poses without constructing an Ammo world", () => {
  const shell = {
    positions: [0, 0, 0],
    indices: [],
    bounds: {},
  };
  const items = [shell];
  ObjectDataCache.data = {
    version: 1,
    entries: {
      bowls: {
        [ObjectDataCache.key({
          shell,
          items,
        })]: [{
          position: {
            x: 1,
            y: 2,
            z: 3,
          },
          rotation: {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
          },
        }],
      },
    },
  };
  const poses = BowlPacking.settle(shell, items);
  assert.equal(poses[0].position.length(), Math.sqrt(14));
  assert.equal(poses[0].rotation.clone().w, 1);
});

test("roof hit loads local box recipes without traversing mesh geometry", () => {
  const boxes = [{
    path: [0, 2],
    center: [0, 0.5, 0],
    halfExtents: [1, 0.1, 1],
  }];
  ObjectDataCache.data = {
    version: 1,
    entries: { roofs: { [ObjectDataCache.key("blue-roof")]: boxes } },
  };
  assert.deepEqual(RoofCollisionLayout.read({}), boxes);
});

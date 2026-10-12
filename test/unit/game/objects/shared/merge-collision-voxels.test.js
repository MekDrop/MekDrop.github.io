import assert from "node:assert/strict";
import { it } from "node:test";
import { mergeCollisionVoxels } from "../../../../../src/game/objects/shared/MergeCollisionVoxels.js";

it("merges a solid volume into one box", () => {
  const cells = [];
  for (let y = 0; y < 5; y++) {
    for (let z = -2; z < 2; z++) {
      for (let x = -3; x < 3; x++) cells.push({ x, y, z });
    }
  }
  assert.deepEqual(mergeCollisionVoxels(cells), [{ x: -3, y: 0, z: -2, width: 6, height: 5, depth: 4 }]);
});

it("preserves sparse voxel occupancy without overlapping boxes or filling openings", () => {
  for (let seed = 0; seed < 20; seed++) {
    const cells = [];
    const expected = new Set();
    for (let x = -3; x <= 3; x++) {
      for (let y = 0; y <= 4; y++) {
        for (let z = -3; z <= 3; z++) {
          if ((x * 31 + y * 17 + z * 13 + seed * 7) % 5 === 0) continue;
          cells.push({ x, y, z });
          expected.add(`${x}:${y}:${z}`);
        }
      }
    }
    const actual = new Set();
    for (const box of mergeCollisionVoxels(cells)) {
      for (let x = box.x; x < box.x + box.width; x++) {
        for (let y = box.y; y < box.y + box.height; y++) {
          for (let z = box.z; z < box.z + box.depth; z++) {
            const key = `${x}:${y}:${z}`;
            assert.ok(!actual.has(key), "boxes must not overlap");
            actual.add(key);
          }
        }
      }
    }
    assert.deepEqual(actual, expected);
  }
});

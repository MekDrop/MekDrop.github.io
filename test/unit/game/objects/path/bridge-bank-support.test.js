import assert from "node:assert/strict";
import { test } from "node:test";
import { hasBridgeBankSupport } from "../../../../../src/game/objects/path/BridgeBankSupport.js";

test("a bank anchor requires solid, level support under both lanes", () => {
  const map = {
    grid: Array.from({ length: 4 }, () => [1, 1, 1, 1]),
    heightmap: Array.from({ length: 4 }, () => [2, 2, 2, 2]),
    tileMeta: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({}))),
  };
  const horizontal = {
    horizontal: true,
    crossCenter: 1.5,
  };
  assert.equal(hasBridgeBankSupport(map, horizontal, 2, 0), true);
  assert.equal(hasBridgeBankSupport(map, horizontal, 3, 0, [1, 1]), true);
  assert.equal(hasBridgeBankSupport(map, horizontal, 3, 0, [1, 0]), false);
  map.grid[2][0] = 0;
  assert.equal(hasBridgeBankSupport(map, horizontal, 2, 0), false);
  map.grid[2][0] = 1;
  map.heightmap[2][0] = 1.7;
  assert.equal(hasBridgeBankSupport(map, horizontal, 2, 0), false);
  map.heightmap[2][0] = 0.5;
  assert.equal(hasBridgeBankSupport(map, horizontal, 2, 0), false);
  map.heightmap[2][0] = 2;
  map.tileMeta[2][0].bridgeCollapsed = true;
  assert.equal(hasBridgeBankSupport(map, horizontal, 2, 0), false);
  map.tileMeta[2][0].bridgeCollapsed = false;
  map.tileMeta[2][0].bridgeCollapsing = true;
  assert.equal(hasBridgeBankSupport(map, horizontal, 2, 0), false);
  assert.equal(hasBridgeBankSupport(map, {
    horizontal: false,
    crossCenter: 1.5,
  }, 2, -1), false);
});

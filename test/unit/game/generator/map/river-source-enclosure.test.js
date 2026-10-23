import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverRouter } from '../../../../../src/game/generator/map/RiverRouter.js';
import { MAP_TILE_TYPE } from '../../../../../src/game/enum/MapTileType.js';
import { MapGenerator } from '../../../../../src/game/generator/map/MapGenerator.js';

it('rejects a spring on a raised tile with exposed lower sides', () => {
  const grid = Array.from({ length: 42 }, () => Array(42).fill(MAP_TILE_TYPE.GRASS));
  const heights = grid.map(row => row.map(() => 2));
  const router = new RiverRouter({}, async () => {});
  const route = [{
    col: 20,
    row: 20,
  }, {
    col: 20,
    row: 21,
  }];
  assert.equal(router.riverSourceHasEarthEnclosure(grid, route, heights), true);
  heights[20][19] = 1;
  assert.equal(router.riverSourceHasEarthEnclosure(grid, route, heights), false);
});

it('keeps every new branch outside the source enclosure on the reported map', async () => {
  const map = await MapGenerator.generate({ mapName: 'mvjtl1yb_0qze68c' });
  assert.ok(map.riverData.length);
  for (const river of map.riverData) {
    if (!river.sourceId) {
      continue;
    }
    for (const cell of river.cells.slice(river.branchStart)) {
      assert.ok(Math.max(Math.abs(cell.col - river.source.col), Math.abs(cell.row - river.source.row)) > 1);
    }
  }
});

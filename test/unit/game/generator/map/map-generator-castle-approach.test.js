import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createCastleStairFlight } from '../../../../../src/game/objects/castle/stairs/CastleStairFlight.js';
import { MapGenerator } from '../../../../../src/game/generator/map/MapGenerator.js';

it('takes every generated route under the tower bridge before returning to its door', async () => {
  for (const mapName of ['mvjtl1yb_0qze68c', '6', '7']) {
    for (const numPaths of [1, 2, 3, 4]) {
      const map = await MapGenerator.generate({
        mapName,
        numPaths,
        numRivers: 0,
        overpass: false,
      });
      const door = map.castle.doors[0];
      assert.equal(map.castle.doors.length, 1, 'underpass crossings are not additional doors');
      const plan = map.objects.find(object => object.object === 'Castle').buildPlan;
      assert.equal(createCastleStairFlight(plan.input.position, plan.input.doors[0]), null, 'raised path replaces the exterior stairs');
      const landingRow = Math.floor(door.centerRow);
      for (let col = door.centerCol - 2; col < door.centerCol; col++) {
        for (let row = landingRow; row <= landingRow + 1; row++) {
          assert.equal(map.heightmap[row][col], plan.input.position.elevation, 'flat 2x2 landing meets door bottom');
          assert.equal(map.tileMeta[row][col].shape, 'FLAT');
          assert.equal(map.tileMeta[row][col].slope, undefined);
        }
      }
      const borderCol = door.centerCol - 3;
      const approachSide = mapName === '6' ? 5 : -5;
      const firstBorderRow = Math.floor(Math.min(door.centerRow, door.centerRow - approachSide));
      const lastBorderRow = Math.ceil(Math.max(door.centerRow, door.centerRow - approachSide));
      for (let row = firstBorderRow; row <= lastBorderRow; row++) {
        assert.equal(map.grid[row][borderCol], 1, 'outer border retains grass ownership');
        assert.equal(map.heightmap[row][borderCol], 3, 'continuous raised grass beside ramp and landing');
      }
      const ramp = map.tileMeta.flat().filter(meta => meta.slope && meta.baseHeight > 2 && meta.baseHeight < 3);
      assert.equal(ramp.length, 4, 'two ramp stations across both path lanes');
      for (const { route } of map.paths) {
        const underpass = route.findIndex(point => point.col === door.centerCol + 7.5 && point.row === door.centerRow);
        assert.ok(underpass > 0, `${mapName}/${numPaths} must not shortcut the bridge`);
        assert.ok(route.slice(underpass + 1).some(point => point.col < door.centerCol && Math.abs(point.row - door.centerRow) === 5));
        assert.deepEqual(route.at(-1), {
          col: door.centerCol,
          row: door.centerRow,
          elevation: 3,
        });
        for (const point of route) {
          assert.equal(map.grid[Math.floor(point.row)][Math.floor(point.col)] === 2 || map.grid[Math.floor(point.row)][Math.floor(point.col)] === 5, true, 'route stays on carved paving');
        }
      }
    }
  }
});

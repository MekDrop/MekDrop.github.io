import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverSurfaceHeights } from '../../src/game/objects/water/RiverSurfaceHeights.js';

it('seals small clearance steps through straight sections and bends', () => {
  const cells = [
    { col: 0, row: 0, elevation: 1.5 },
    { col: 1, row: 0, elevation: 1.48 },
    { col: 1, row: 1, elevation: 1.48 },
  ];
  const heights = new RiverSurfaceHeights(cells);
  const [first, bend, last] = cells.map((cell) => heights.cornersFor(cell));
  assert.equal(first[1], bend[0]);
  assert.equal(first[3], bend[2]);
  assert.equal(bend[2], last[0]);
  assert.equal(bend[3], last[1]);
  assert.ok(first[1] > 1.492 && first[1] < 1.512);
});

it('preserves the full elevation difference at real cascades', () => {
  const cells = [
    { col: 0, row: 0, elevation: 2.5 },
    { col: 1, row: 0, elevation: 1.5 },
  ];
  const heights = new RiverSurfaceHeights(cells);
  assert.deepEqual(heights.cornersFor(cells[0]), Array(4).fill(2.512));
  assert.deepEqual(heights.cornersFor(cells[1]), Array(4).fill(1.512));
});

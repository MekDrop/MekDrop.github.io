import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WaterfallGeometry } from '../../src/game/objects/water/WaterfallGeometry.js';

function patchesFor(direction, terminal, drop = terminal ? 13.5 : 1) {
  const patches = [];
  new WaterfallGeometry(
    { col: 5, row: 4, topElevation: 2.5, bottomElevation: 2.5 - drop },
    direction, 11, 9, terminal, 7,
  ).append((rows, columns, pointAt, normal, colorAt, reverse, weld, uvAt) => {
    patches.push({ rows, columns, pointAt, normal, colorAt, reverse, weld, uvAt });
  });
  return patches;
}

describe('waterfall geometry', () => {
  for (const drop of [1, 2, 4, 4.5, 6, 13.5]) {
    it(`only narrows drops taller than four cubes (height ${drop})`, () => {
      const [front] = patchesFor({ col: 1, row: 0 }, true, drop);
      for (let row = 0; row <= front.rows; row++) {
        const width = front.pointAt(row, front.columns)[2] - front.pointAt(row, 0)[2];
        if (drop <= 4) {
          assert.equal(width, 1);
        } else {
          assert.ok(width <= 1);
        }
      }
      if (drop > 4) {
        const bottomWidth = front.pointAt(front.rows, front.columns)[2] -
          front.pointAt(front.rows, 0)[2];
        assert.ok(bottomWidth < 1);
      }
    });
  }

  for (const direction of [
    { col: 1, row: 0 }, { col: -1, row: 0 },
    { col: 0, row: 1 }, { col: 0, row: -1 },
  ]) {
    it(`joins the full channel width and depth for ${JSON.stringify(direction)}`, () => {
      const [front, rear] = patchesFor(direction, true);
      for (let column = 0; column <= front.columns; column++) {
        const a = front.pointAt(0, column);
        const b = rear.pointAt(0, column);
        const across = column / front.columns - 0.5;
        assert.deepEqual(a, [
          direction.col * 0.5 - direction.row * across,
          2.512,
          direction.row * 0.5 + direction.col * across,
        ]);
        assert.ok(Math.abs(a[1] - b[1] - 0.5) < 1e-10);
        assert.equal(a[0], b[0]);
        assert.equal(a[2], b[2]);
        assert.deepEqual(front.uvAt(0, column), [column / front.columns, 7]);
      }
    });
  }

  for (const terminal of [false, true]) {
    it(`keeps side faces sealed and flow downhill (${terminal ? 'terminal' : 'landing'})`, () => {
      const [front, rear, left, right] = patchesFor({ col: 1, row: 0 }, terminal);
      for (let row = 0; row <= front.rows; row++) {
        assert.deepEqual(left.pointAt(row, 0), front.pointAt(row, 0));
        assert.deepEqual(left.pointAt(row, 1), rear.pointAt(row, 0));
        assert.deepEqual(right.pointAt(row, 0), front.pointAt(row, front.columns));
        assert.deepEqual(right.pointAt(row, 1), rear.pointAt(row, front.columns));
        for (let col = 0; col <= front.columns; col++) {
          assert.ok(front.pointAt(row, col).every(Number.isFinite));
          if (row > 0) {
            assert.ok(front.pointAt(row, col)[1] <= front.pointAt(row - 1, col)[1]);
            assert.ok(front.uvAt(row, col)[1] > front.uvAt(row - 1, col)[1]);
          }
          if (!terminal) {
            assert.equal(front.colorAt(row, col)[3], 255);
            assert.ok(front.pointAt(row, col)[1] >= 1.487 - 1e-10);
          }
        }
      }
      if (terminal) {
        assert.equal(front.colorAt(front.rows, 6)[3], 0);
        assert.ok(front.pointAt(front.rows, 6)[1] < -10.5);
      } else {
        assert.ok(Math.abs(front.pointAt(front.rows, 6)[1] - 1.487) < 1e-10);
      }
    });
  }
});

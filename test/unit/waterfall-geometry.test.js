import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WaterfallGeometry } from '../../src/game/objects/water/WaterfallGeometry.js';

function patchesFor(
  direction,
  terminal,
  drop = terminal ? 13.5 : 1,
  section = 'all',
  join = null,
) {
  const patches = [];
  new WaterfallGeometry(
    { col: 5, row: 4, topElevation: 2.5, bottomElevation: 2.5 - drop },
    direction, 11, 9, terminal, 7, join,
  ).append(
    (
      rows,
      columns,
      pointAt,
      normal,
      colorAt,
      reverse,
      weld,
      uvAt,
      metadataAt,
    ) => {
      patches.push({
        rows,
        columns,
        pointAt,
        normal,
        colorAt,
        reverse,
        weld,
        uvAt,
        metadataAt,
      });
    },
    section,
  );
  return patches;
}

describe('waterfall geometry', () => {
  for (const drop of [1, 2, 4, 4.5, 6, 13.5]) {
    it(`only narrows drops taller than four cubes (height ${drop})`, () => {
      const [front] = patchesFor({ col: 1, row: 0 }, true, drop);
      for (let row = 0; row <= front.rows; row++) {
        const width = front.pointAt(row, front.columns)[2] - front.pointAt(row, 0)[2];
        if (drop <= 4) {
          assert.ok(width >= 1);
          assert.ok(width <= 1.024);
        } else {
          assert.ok(width <= 1.024);
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
      assert.equal(front.weld, false);
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
        const metadataMagnitude = 2 + column / front.columns;
        const expectedMetadata = [
          direction.col * metadataMagnitude,
          direction.row * metadataMagnitude,
        ];
        assert.deepEqual(front.metadataAt(0, column), expectedMetadata);
        assert.deepEqual(front.metadataAt(1, column), expectedMetadata);
      }
    });
  }

  it('keeps the shared lip exact while hiding overlap inside the bend', () => {
    const [front] = patchesFor({ col: 1, row: 0 }, true);
    const topWidth = front.pointAt(0, front.columns)[2] - front.pointAt(0, 0)[2];
    const middleWidth = front.pointAt(6, front.columns)[2] -
      front.pointAt(6, 0)[2];
    const lipWidth = front.pointAt(12, front.columns)[2] -
      front.pointAt(12, 0)[2];
    assert.equal(topWidth, 1);
    assert.equal(middleWidth, 1.024);
    assert.equal(lipWidth, 1);
  });

  it('uses the river boundary points verbatim at both lip endings', () => {
    const join = {
      front: Array.from({ length: 13 }, (_, index) => [index, 3 + index, 4]),
      rear: Array.from({ length: 13 }, (_, index) => [index, 2 + index, 4]),
      uvs: Array.from({ length: 13 }, (_, index) => [index / 12, 9]),
    };
    const [front, rear] = patchesFor(
      { col: 0, row: 1 },
      true,
      13.5,
      'all',
      join,
    );
    assert.equal(front.weld, false);
    assert.equal(rear.weld, false);
    for (let column = 0; column <= front.columns; column += 1) {
      assert.strictEqual(front.pointAt(0, column), join.front[column]);
      assert.strictEqual(rear.pointAt(0, column), join.rear[column]);
      assert.strictEqual(front.uvAt(0, column), join.uvs[column]);
      assert.strictEqual(rear.uvAt(0, column), join.uvs[column]);
      const metadataMagnitude = 2 + column / front.columns;
      assert.deepEqual(front.metadataAt(0, column), [0, metadataMagnitude]);
      assert.deepEqual(rear.metadataAt(0, column), [0, metadataMagnitude]);
      assert.equal(front.colorAt(0, column)[0], 0);
      assert.equal(rear.colorAt(0, column)[0], 255);
    }
  });

  it('keeps edge sway pinned without relying on optional UV0 attributes', () => {
    const [front, rear, left, right] = patchesFor(
      { col: -1, row: 0 },
      true,
    );
    const middleColumn = front.columns / 2;
    assert.equal(Math.hypot(...front.metadataAt(0, 0)), 2);
    assert.equal(Math.hypot(...front.metadataAt(0, middleColumn)), 2.5);
    assert.equal(Math.hypot(...rear.metadataAt(0, front.columns)), 3);
    assert.equal(Math.hypot(...left.metadataAt(0, 0)), 2);
    assert.equal(Math.hypot(...right.metadataAt(0, 0)), 3);
  });

  it('splits a terminal fall at one exact opaque-to-transparent boundary', () => {
    const [body] = patchesFor({ col: 0, row: 1 }, true, 13.5, 'body');
    const [tail] = patchesFor({ col: 0, row: 1 }, true, 13.5, 'tail');
    assert.ok(body.rows > tail.rows);
    for (let column = 0; column <= body.columns; column++) {
      assert.deepEqual(
        body.pointAt(body.rows, column),
        tail.pointAt(0, column),
      );
      assert.deepEqual(
        body.uvAt(body.rows, column),
        tail.uvAt(0, column),
      );
      assert.equal(body.colorAt(body.rows, column)[3], 255);
      assert.equal(tail.colorAt(0, column)[3], 255);
    }
  });

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

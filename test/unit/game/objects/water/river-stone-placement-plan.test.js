import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RiverStonePlacementPlan } from '../../../../../src/game/objects/water/RiverStonePlacementPlan.js';

const MODEL_HEIGHTS = [0.20761, 0.14188, 0.27262];

function riverFixture() {
  const cells = Array.from({ length: 20 }, (_, col) => ({
    col,
    row: 3,
    bedElevation: 1,
    elevation: 1.5,
    direction: 'EAST',
    underBridge: col === 5,
  }));
  return {
    cells,
    cascades: [{ from: cells[8], to: cells[9] }],
    waterfall: { col: 19, row: 3 },
  };
}

describe('river stone placement plan', () => {
  it('keeps seeded placement deterministic', () => {
    const plan = new RiverStonePlacementPlan(MODEL_HEIGHTS);
    const first = plan.create([riverFixture()], 21, 9);
    const second = plan.create([riverFixture()], 21, 9);

    assert.deepEqual(second, first);
    assert.deepEqual(first.map(({ cell }) => cell), [
      { col: 4, row: 3 },
      { col: 12, row: 3 },
      { col: 16, row: 3 },
    ]);
    assert.deepEqual(first.map(({ modelIndex }) => modelIndex), [2, 1, 0]);
});
  it('respects blocked cells and the three-stone river limit', () => {
    const placements = new RiverStonePlacementPlan(MODEL_HEIGHTS).create(
      [riverFixture()],
      21,
      9,
    );
    const blockedColumns = new Set([0, 5, 8, 9, 19]);

    assert.equal(placements.length, 3);
    for (const placement of placements) {
      assert.equal(blockedColumns.has(placement.cell.col), false);
      assert.ok(placement.modelIndex >= 0 && placement.modelIndex < 3);
      assert.ok(placement.position.every(Number.isFinite));
      assert.ok(placement.scale.every(Number.isFinite));
    }
  });
});

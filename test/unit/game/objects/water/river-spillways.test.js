import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverSpillways } from '../../../../../src/game/objects/water/RiverSpillways.js';

it('spills down all three lower sides while retaining the upstream inlet', () => {
  const cells = [
    {
      col: 2,
      row: 1,
      elevation: 4,
    },
    {
      col: 2,
      row: 2,
      elevation: 4,
    },
    {
      col: 2,
      row: 3,
      elevation: 1,
    },
    {
      col: 1,
      row: 2,
      elevation: 2,
    },
    {
      col: 3,
      row: 2,
      elevation: 0.5,
    },
  ];
  const river = {
    cells,
    cascades: [{
      from: cells[1],
      to: cells[2],
      direction: 'SOUTH',
      topElevation: 4,
      bottomElevation: 1,
    }],
  };
  const spills = RiverSpillways.cascadesFor(river, [river]);
  const ledge = spills.filter(spill => spill.from.col === 2 && spill.from.row === 2);
  assert.deepEqual(ledge.map(spill => spill.direction).sort(), ['EAST', 'SOUTH', 'WEST']);
  assert.deepEqual(ledge.map(spill => spill.bottomElevation).sort(), [0.5, 1, 2]);
});

it('does not duplicate a shared upstream spill in a branch or invent a source fall', () => {
  const root = {
    cells: [
      {
        col: 2,
        row: 1,
        elevation: 4,
      },
      {
        col: 2,
        row: 2,
        elevation: 4,
      },
      {
        col: 2,
        row: 3,
        elevation: 1,
      },
    ],
    cascades: [],
  };
  const branch = {
    branchStart: 2,
    cells: [root.cells[0], root.cells[1], {
      col: 3,
      row: 2,
      elevation: 1,
    }],
    cascades: [{
      from: root.cells[1],
      to: {
        col: 3,
        row: 2,
      },
      direction: 'EAST',
      topElevation: 4,
      bottomElevation: 1,
    }],
  };
  assert.equal(RiverSpillways.cascadesFor(root, [root, branch]).length, 2);
  assert.equal(RiverSpillways.cascadesFor(branch, [root, branch]).length, 0);
});

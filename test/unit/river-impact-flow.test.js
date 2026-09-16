import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverImpactFlow } from '../../src/game/objects/water/RiverImpactFlow.js';

const directions = [
  ['EAST', 1, 0], ['SOUTH', 0, 1], ['WEST', -1, 0], ['NORTH', 0, -1],
];
for (const [index, [name, dx, dz]] of directions.entries()) {
  for (const turn of [-1, 0, 1]) {
    const [outgoing, ex, ez] = directions[(index + turn + 4) % 4];
    const source = { col: 5, row: 5, elevation: 2.5, direction: name };
    const landing = { col: 5 + dx, row: 5 + dz, elevation: 1.5, direction: outgoing };
    const river = {
      kind: 'WATER',
      cells: [source, landing, ...[1, 2, 3].map(step => ({
        ...landing, col: landing.col + ex * step, row: landing.row + ez * step,
      }))],
      cascades: [{ from: source, to: landing, direction: name, topElevation: 2.5, bottomElevation: 1.5 }],
    };
    const field = new RiverImpactFlow([river]);
    const sample = (forward, across) => field.sample(
      5 + dx * forward - dz * across, 5 + dz * forward + dx * across,
    );
    it(`spreads from a ${name}/${outgoing} impact in all four directions`, () => {
      for (const [along, across] of [[-0.08, 0], [0.08, 0], [0, -0.08], [0, 0.08]]) {
        const [vx, vz, influence] = sample(0.785 + along, across);
        const outward = vx * (dx * along - dz * across) + vz * (dz * along + dx * across);
        assert.ok(outward > 0.045, `outward velocity ${outward}`);
        assert.equal(influence, 1);
      }
    });
    it(`turns ${name}/${outgoing} backwash at the cliff and joins the outlet`, () => {
      const [vx, vz] = sample(0.501, 0);
      assert.ok(vx * dx + vz * dz >= -0.00001, 'does not flow into cliff');
      assert.ok(vx * ex + vz * ez > 0.4, 'redirects toward outlet');
      const downstream = field.sample(landing.col + ex * 0.7, landing.row + ez * 0.7);
      assert.ok(downstream[0] * ex + downstream[1] * ez > 0.6);
      for (const [, nx, nz] of directions) {
        if (nx === ex && nz === ez) {
          continue;
        }
        const v = field.sample(landing.col + nx * 0.499, landing.row + nz * 0.499);
        assert.ok(v[0] * nx + v[1] * nz <= 0.00001, 'does not flow through a closed bank');
      }
    });
    it(`includes the cliff and closed corner in ${name}/${outgoing} bank effects`, () => {
      const banks = field.bankMask(landing.col, landing.row);
      for (const [side, [nx, nz]] of [[-1, 0], [1, 0], [0, -1], [0, 1]].entries()) {
        assert.equal(banks[side], nx === ex && nz === ez ? 0 : 1);
      }
      assert.deepEqual(field.bankMask(0, 0), [0, 0, 0, 0]);
    });
    it(`isolates ${name}/${outgoing} impact from upstream, dry land, and lava`, () => {
      assert.deepEqual(field.sample(5, 5), [0, 0, 0]);
      assert.deepEqual(field.sample(0, 0), [0, 0, 0]);
      assert.deepEqual(field.sample(landing.col + ex * 3, landing.row + ez * 3), [0, 0, 0]);
      assert.deepEqual(new RiverImpactFlow([{ ...river, kind: 'LAVA' }]).sample(landing.col, landing.row), [0, 0, 0]);
    });
  }
}

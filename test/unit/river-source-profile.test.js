import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverSourceProfile } from '../../src/game/objects/water/RiverSourceProfile.js';

const directions = [
  ['EAST', 1, 0], ['SOUTH', 0, 1], ['WEST', -1, 0], ['NORTH', 0, -1],
];
for (const [index, [name, dx, dz]] of directions.entries()) {
  for (const turn of [-1, 0, 1]) {
    const [outgoing, ex, ez] = directions[(index + turn + 4) % 4];
    it(`releases source pressure across the entire ${name}/${outgoing} outlet`, () => {
      const profile = new RiverSourceProfile([
        { col: 5, row: 6, direction: name },
        { col: 5 + dx, row: 6 + dz, direction: outgoing },
      ]);
      // Include the inside L corner, where angular route coordinates are singular.
      for (let i = 0; i <= 12; i++) {
        const across = i / 12 - 0.5;
        const col = 5 + dx + ex * 0.5 - ez * across;
        const row = 6 + dz + ez * 0.5 + ex * across;
        assert.equal(profile.sample(col, row)[0], 0);
        assert.ok(profile.sample(col, row).every(Number.isFinite));
        assert.ok(profile.sample(col - ex * 0.00001, row - ez * 0.00001)[0] < 1e-7);
      }
      assert.equal(profile.sample(5 + dx * 0.5, 6 + dz * 0.5)[0], 1);
      assert.equal(profile.sample(5 - dx * 0.5, 6 - dz * 0.5)[0], 0);
    });
  }
}

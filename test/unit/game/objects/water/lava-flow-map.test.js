import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverFlowMap } from '../../../../../src/game/objects/water/RiverFlowMap.js';

it('retains lava route distance and both bend directions without allocating water effects', () => {
  const textures = [];
  class Texture {
    constructor(_device, options) {
      this.data = new Float32Array(options.width * options.height * 4);
      this.destroyed = false;
      textures.push(this);
    }
    lock() {
      return this.data;
    }
    unlock() {}
    destroy() {
      this.destroyed = true;
    }
  }
  const directions = [
    ['NORTH', 0, -1], ['EAST', 1, 0], ['SOUTH', 0, 1], ['WEST', -1, 0],
  ];
  for (const [incoming, x, z] of directions) {
    for (const [outgoing, dx, dz] of directions) {
      if (x * dx + z * dz !== 0) {
        continue;
      }
      const map = new RiverFlowMap({ Texture }, null, {
        cols: 5,
        rows: 5,
        riverData: [{
          kind: 'LAVA',
          cells: [
            {
              col: 2 - x,
              row: 2 - z,
              direction: incoming,
            },
            {
              col: 2,
              row: 2,
              direction: outgoing,
            },
            {
              col: 2 + dx,
              row: 2 + dz,
              direction: outgoing,
            },
          ],
        }],
      }, false);
      const parameters = new Map();
      map.apply({ setParameter: (name, value) => parameters.set(name, value) });
      const texture = parameters.get('uRiverFlowMap');
      assert.deepEqual([...texture.data.slice(48, 52)], [1, dx, dz, x * dz - z * dx]);
      const downstream = ((2 + dz) * 5 + 2 + dx) * 4;
      assert.deepEqual([...texture.data.slice(downstream, downstream + 4)], [2, dx, dz, 0]);
      assert.deepEqual(parameters.get('uRiverMapSize'), [5, 5]);
      assert.equal(parameters.has('uCascadeCurrentMap'), false);
      map.destroy();
      assert.equal(texture.destroyed, true);
    }
  }
  assert.equal(textures.length, 8);
});

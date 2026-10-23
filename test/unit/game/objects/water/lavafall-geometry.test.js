import assert from 'node:assert/strict';
import { it } from 'node:test';
import { LavafallGeometry } from '../../../../../src/game/objects/water/LavafallGeometry.js';

for (const [direction, dx, dz] of [
  ['EAST', 1, 0], ['WEST', -1, 0], ['NORTH', 0, -1], ['SOUTH', 0, 1],
]) {
  for (const terminal of [false, true]) {
    it(
      `keeps ${direction} lavafall side paint continuous and the curtain thin (terminal=${terminal})`,
      () => {
        const group = {
          positions: [],
          normals: [],
          colors: [],
          uvs: [],
          uvs1: [],
          sourceUvs: [],
          indices: [],
          weldedVertices: new Map(),
        };
        new LavafallGeometry().append(group, {
          col: 3,
          row: 3,
          direction,
          topElevation: 2,
          bottomElevation: -8,
        }, 7, 7, terminal, 9);
        for (const side of [-1, 1]) {
          const vertices = [];
          for (let i = 0; i < group.positions.length / 3; i++) {
            const nx = group.normals[i * 3];
            const nz = group.normals[i * 3 + 2];
            if (Math.abs((-dz * nx + dx * nz) - side) < 0.001) {
              vertices.push(i);
            }
          }
          assert.ok(vertices.length > 48);
          let previous = 9;
          const steps = [];
          for (let offset = 0; offset < vertices.length; offset += 4) {
            const [frontTop, frontBottom, rearBottom, rearTop] = vertices.slice(offset, offset + 4);
            const uv = (index) => group.uvs.slice(index * 2, index * 2 + 2);
            assert.deepEqual(uv(frontTop), uv(rearTop));
            assert.deepEqual(uv(frontBottom), uv(rearBottom));
            assert.ok(Math.abs(uv(frontTop)[1] - previous) < 1e-6);
            assert.ok(uv(frontBottom)[1] > previous);
            steps.push(uv(frontBottom)[1] - previous);
            previous = uv(frontBottom)[1];
            if (offset >= 12 * 4) {
              const thickness =
                (group.positions[frontTop * 3] - group.positions[rearTop * 3]) * dx +
                (group.positions[frontTop * 3 + 2] - group.positions[rearTop * 3 + 2]) * dz;
              assert.ok(Math.abs(thickness - 0.12) < 1e-6);
            }
          }
          assert.ok(previous > 10);
          assert.ok(previous < 18);
          // Equal-length vertical strips consume less travel time downstream.
          assert.ok(steps.at(-1) < steps[12]);
          if (terminal) {
            const last = vertices.slice(-4);
            assert.equal(group.colors[last[1] * 4 + 3], 0);
            assert.equal(group.colors[last[2] * 4 + 3], 0);
          }
        }
      },
    );
  }
}

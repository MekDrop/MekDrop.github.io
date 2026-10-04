import assert from 'node:assert/strict';
import { it } from 'node:test';
import { RiverMeshBuilder } from '../../../../../src/game/objects/water/RiverMeshBuilder.js';

class FakeMesh {
  setPositions() {}
  setNormals() {}
  setColors32() {}
  setUvs() {}
  setIndices() {}
  update() {}
}

class FakeEntity {
  addComponent() {}
}

function surfaceFor(direction, kind = 'WATER') {
  let surface;
  const builder = new RiverMeshBuilder({
    pc: { Mesh: FakeMesh, MeshInstance: class {}, Entity: FakeEntity },
    device: null,
    entity: { addChild() {} },
    riverKind: kind,
    mapData: {
      cols: 3, rows: 3,
      riverData: [{
        kind,
        cells: [{ col: 1, row: 1, direction, elevation: 2 }],
        cascades: [],
        waterfall: { col: 1, row: 1, direction },
      }],
    },
  });
  builder.build({
    createSourceProfile: () => null,
    isSpringSource: () => false,
    surfaceCorners: () => null,
    appendCascade() {},
    appendTerminal: ({ riverGroup }) => { surface = riverGroup; },
    createMaterial: () => null,
  });
  return surface;
}

for (const [direction, dx, dz] of [
  ['NORTH', 0, -1], ['SOUTH', 0, 1],
  ['EAST', 1, 0], ['WEST', -1, 0],
]) {
  it(`blends waterfall paint before the ${direction} lip without changing opacity`, () => {
    const surface = surfaceFor(direction);
    const alphaByProgress = new Map();
    // The first grid is the complete horizontal top, before bottom/side faces.
    for (let vertex = 0; vertex < 13 * 13; vertex++) {
      const progress = 0.5 + surface.positions[vertex * 3] * dx +
        surface.positions[vertex * 3 + 2] * dz;
      const alpha = surface.colors[vertex * 4 + 3];
      if (progress < 0.65) {
        assert.equal(alpha, 255);
      }
      if (progress === 1) {
        assert.equal(alpha, 0);
      }
      if (alphaByProgress.has(progress)) {
        assert.equal(alpha, alphaByProgress.get(progress));
      }
      alphaByProgress.set(progress, alpha);
    }
    const ordered = [...alphaByProgress.entries()].sort((a, b) => a[0] - b[0]);
    assert.ok(ordered.some(([, alpha]) => alpha > 0 && alpha < 255));
    for (let index = 1; index < ordered.length; index++) {
      assert.ok(ordered[index][1] <= ordered[index - 1][1]);
    }
    // The opaque river material owns this metadata; bottom faces retain depth.
    for (let vertex = 13 * 13; vertex < 2 * 13 * 13; vertex++) {
      assert.equal(surface.colors[vertex * 4 + 3], 255);
    }
  });
}

it('keeps lava surface metadata unchanged', () => {
  const surface = surfaceFor('SOUTH', 'LAVA');
  for (let vertex = 0; vertex < 13 * 13; vertex++) {
    assert.equal(surface.colors[vertex * 4 + 3], 255);
  }
});

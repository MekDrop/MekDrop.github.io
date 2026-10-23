import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
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

it('builds three distinct, joined curtains for the saved three-way ledge', () => {
  const map = JSON.parse(readFileSync(new URL('../../../../../src/game/maps/tests/river-three-way-spill.json', import.meta.url)));
  const cascades = [];
  const builder = new RiverMeshBuilder({
    pc: {
      Mesh: FakeMesh,
      MeshInstance: class {
        setParameter() {}
      },
      Entity: FakeEntity,
    },
    device: null,
    entity: { addChild: () => {} },
    riverKind: 'WATER',
    mapData: {
      ...map,
      riverData: map.objects[0].rivers,
    },
  });
  builder.build({
    createSourceProfile: () => null,
    isSpringSource: () => false,
    surfaceCorners: () => null,
    appendCascade: options => cascades.push(options),
    appendTerminal: () => {},
    createMaterial: () => null,
  });
  assert.deepEqual(cascades.map(({ cascade }) => cascade.direction).sort(), ['EAST', 'NORTH', 'SOUTH']);
  for (const { cascade, join } of cascades) {
    assert.equal(cascade.bottomElevation, 0.5);
    assert.equal(join.front.length, 13);
    assert.deepEqual(join.uvs.map(uv => uv[0]), Array.from({ length: 13 }, (_, index) => index / 12));
    assert.ok(join.uvs.every(uv => uv[1] === join.uvs[0][1]));
    assert.ok(join.front.every(point => point[1] === 1.512));
    assert.ok(join.front.every(point => cascade.direction === 'EAST' ? point[0] === 1.5 :
      point[2] === (cascade.direction === 'NORTH' ? -0.5 : 0.5)));
  }
});

function surfaceFor(direction, kind = 'WATER') {
  let surface;
  const builder = new RiverMeshBuilder({
    pc: {
      Mesh: FakeMesh,
      MeshInstance: class {
        setParameter() {}
      },
      Entity: FakeEntity,
    },
    device: null,
    entity: { addChild: () => {} },
    riverKind: kind,
    mapData: {
      cols: 3,
      rows: 3,
      riverData: [{
        kind,
        cells: [{
          col: 1,
          row: 1,
          direction,
          elevation: 2,
        }],
        cascades: [],
        waterfall: {
          col: 1,
          row: 1,
          direction,
        },
      }],
    },
  });
  builder.build({
    createSourceProfile: () => null,
    isSpringSource: () => false,
    surfaceCorners: () => null,
    appendCascade: () => {},
    appendTerminal: ({ riverGroup }) => {
      surface = riverGroup;
    },
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

it('keeps the waterfall on the upstream animation clock when the landing slows', () => {
  const children = [];
  let cascadeGroup;
  class Mesh extends FakeMesh {
    setPositions(positions) {
      this.positions = positions;
    }
  }
  class MeshInstance {
    constructor(mesh) {
      this.mesh = mesh; this.parameters = new Map();
    }
    setParameter(name, value) {
      this.parameters.set(name, value);
    }
  }
  class Entity {
    addComponent(_type, options) {
      this.meshInstances = options.meshInstances;
    }
  }
  const builder = new RiverMeshBuilder({
    pc: {
      Mesh,
      MeshInstance,
      Entity,
    },
    device: null,
    entity: { addChild: child => children.push(child) },
    riverKind: 'WATER',
    mapData: {
      cols: 3,
      rows: 3,
      riverData: [{
        id: 'river',
        kind: 'WATER',
        cells: [
          {
            col: 1,
            row: 1,
            direction: 'WEST',
            elevation: 2,
          },
          {
            col: 0,
            row: 1,
            direction: 'WEST',
            elevation: 1,
            flowScale: 1 / 3,
          },
        ],
        cascades: [{
          from: {
            col: 1,
            row: 1,
          },
          to: {
            col: 0,
            row: 1,
          },
          direction: 'WEST',
          topElevation: 2,
          bottomElevation: 1,
        }],
        waterfall: {
          col: 0,
          row: 1,
          direction: 'WEST',
        },
      }],
    },
  });
  builder.build({
    createSourceProfile: () => null,
    isSpringSource: () => false,
    surfaceCorners: () => null,
    createMaterial: () => null,
    appendCascade: ({ group }) => {
      cascadeGroup = group;
    },
    appendTerminal: () => {},
  });
  const instances = children.flatMap(child => child.meshInstances);
  const waterfall = instances.find(instance => instance.mesh.positions === cascadeGroup.positions);
  assert.equal(waterfall.parameters.get('uRiverFlowScale'), 1);
  assert.ok(instances.some(instance => instance.parameters.get('uRiverFlowScale') === 1 / 3));
});

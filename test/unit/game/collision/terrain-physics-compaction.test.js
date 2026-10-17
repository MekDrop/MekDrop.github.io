import assert from "node:assert/strict";
import { it } from "node:test";
import { TerrainPhysicsSurface } from "../../../../src/game/collision/TerrainPhysicsSurface.js";
import { MAP_TILE_TYPE } from "../../../../src/game/enum/MapTileType.js";
import { TILE_SHAPE } from "../../../../src/game/enum/TileShape.js";
import { SLOPE_DIRECTION } from "../../../../src/game/enum/SlopeDirection.js";

function build(mapData, collisionWorld = null) {
  let geometry;
  const pc = {
    Entity: class {
      tags = { add: () => {} };
      addComponent(type, value) {
        this[type] = value;
      }
      removeComponent(type) {
        delete this[type];
      }
      destroy() {}
    },
    Mesh: class {
      constructor() {
        geometry = this;
      }
      setPositions(value) {
        this.positions = value;
      }
      setIndices(value) {
        this.indices = value;
      }
      update() {}
      destroy() {}
    },
    StandardMaterial: class {
      update() {}
      destroy() {}
    },
    GraphNode: class {},
    MeshInstance: class {},
    Model: class {},
  };
  const surface = new TerrainPhysicsSurface({
    pc,
    app: { graphicsDevice: {} },
    mapData,
    collisionWorld,
  });
  const triangles = [];
  for (let index = 0; index < geometry.indices.length; index += 3) {
    triangles.push(geometry.indices.slice(index, index + 3).map((vertex) =>
      geometry.positions.slice(vertex * 3, vertex * 3 + 3)));
  }
  surface.destroy();

  return triangles;
}

function fixture() {
  return {
    cols: 8,
    rows: 2,
    grid: Array.from({ length: 2 }, () => Array(8).fill(MAP_TILE_TYPE.PATH)),
    heightmap: Array.from({ length: 2 }, () => Array(8).fill(2)),
    tileMeta: Array.from({ length: 2 }, () => Array.from({ length: 8 }, () => ({}))),
  };
}

function horizontalAt(triangles, height) {
  return triangles.filter((triangle) => triangle.every((point) => point[1] === height));
}

function area(triangles) {
  return triangles.reduce((sum, [a, b, c]) => sum + Math.abs(
    (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]),
  ) / 2, 0);
}

it("merges flat terrain tops without changing their area or upward winding", () => {
  const tops = horizontalAt(build(fixture()), 2);
  assert.equal(tops.length, 4, "two triangles per row instead of per tile");
  assert.equal(area(tops), 16);
  for (const [a, b, c] of tops) {
    assert.ok((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0);
  }
});

it("keeps sample gaps and differing supplemental heights while merging equal runs", () => {
  const samples = [];
  const triangles = build(fixture(), {
    physicsSurfaceHeightAt: (x, z, radius) => {
      samples.push([x, z, radius]);

      return x < -1 ? 3 : x > 1 ? 4 : null;
    },
  });
  assert.equal(samples.length, 8 * 2 * 16, "retains every original quarter-tile sample");
  assert.equal(horizontalAt(triangles, 3).length, 16);
  assert.equal(horizontalAt(triangles, 4).length, 16);
  assert.equal(area(horizontalAt(triangles, 3)), 6);
  assert.equal(area(horizontalAt(triangles, 4)), 6);
});

it("does not merge across an excavation, a ramp, or a change in elevation", () => {
  const map = fixture();
  map.tileMeta[0][2].terrainCutouts = [{
    minX: -1.75,
    maxX: -1.25,
    minY: 1,
    maxY: 3,
    minZ: -1,
    maxZ: 0,
  }];
  map.tileMeta[0][4] = {
    shape: TILE_SHAPE.SLOPE,
    slope: {
      riseDirection: SLOPE_DIRECTION.EAST,
      lowHeight: 2,
      highHeight: 3,
    },
  };
  map.heightmap[0][5] = 3;
  const triangles = build(map);
  assert.equal(area(horizontalAt(triangles, 2)), 13.5);
  assert.equal(area(horizontalAt(triangles, 3)), 1);
  const ramp = triangles.filter((triangle) =>
    triangle.every(([x, y]) => x >= 0 && x <= 1 && y === x + 2));
  assert.equal(area(ramp), 1);
});

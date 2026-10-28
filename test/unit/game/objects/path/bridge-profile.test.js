import assert from "node:assert/strict";
import { it } from "node:test";
import { BridgeProfile } from "../../../../../src/game/objects/path/BridgeProfile.js";
import { BridgeDefinitions } from "../../../../../src/game/objects/path/BridgeDefinitions.js";
import { HeroTerrain } from "../../../../../src/game/objects/characters/hero/HeroTerrain.js";
import { TerrainPhysicsSurface } from "../../../../../src/game/collision/TerrainPhysicsSurface.js";
import { MapObjectDefinitions } from "../../../../../src/game/objects/MapObjectDefinitions.js";

it("keeps docking rails continuous at the anchor and leaves the free tip open in either direction", () => {
  const span = {
    start: 2,
    end: 7,
    length: 6,
  };
  for (const direction of [-1, 1]) {
    const rails = [];
    for (let station = span.start; station <= span.end; station++) {
      const range = BridgeProfile.railRange(span, station, true, direction);
      if (range) {
        rails.push({
          start: station + range.start,
          end: station + range.end,
          endPost: range.endPost,
        });
      }
    }
    for (let index = 1; index < rails.length; index++) {
      assert.equal(rails[index - 1].end, rails[index].start);
      assert.equal(rails[index - 1].endPost, false);
    }
    assert.equal(rails.at(-1).endPost, true);
    const freeStation = direction > 0 ? span.end : span.start;
    assert.equal(BridgeProfile.railRange(span, freeStation, true, direction), null);
    assert.ok(direction > 0 ? rails.at(-1).end < span.end - 1 : rails[0].start > span.start + 1);
  }
});
import { TerrainBlockDefinitions } from "../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { WalkingPaths } from "../../../../../src/game/navigation/WalkingPaths.js";
import { EnemyPaths } from "../../../../../src/game/navigation/EnemyPaths.js";
import { ENEMY_TRAVERSAL } from "../../../../../src/game/enum/EnemyTraversal.js";

/**
 * @param {boolean} horizontal
 * @param {boolean} floating
 */
function fixture(horizontal, floating = false) {
  const cells = [];
  for (let along = 2; along <= 5; along++) {
    for (const across of [3, 4]) {
      cells.push({
        col: horizontal ? along : across,
        row: horizontal ? across : along,
      });
    }
  }
  const bridge = {
    id: "test-profile",
    object: "Bridge",
    elevation: 2,
    material: "wood",
    span: {
      horizontal,
      start: 2,
      end: 5,
      center: 3.5,
      crossCenter: 3.5,
      length: 4,
      cells,
    },
  };
  const map = {
    cols: 8,
    rows: 8,
    grid: Array.from({ length: 8 }, () => Array(8).fill(0)),
    heightmap: Array.from({ length: 8 }, () => Array(8).fill(0)),
    tileMeta: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({}))),
    objects: [bridge, {
      id: "islands",
      object: "IslandConnector",
      topology: {
        cells: floating ? [cells[0]] : [{
          col: 7,
          row: 7,
        }],
      },
    }],
  };
  for (const cell of cells) {
    map.grid[cell.row][cell.col] = 2;
    map.heightmap[cell.row][cell.col] = 2;
    map.tileMeta[cell.row][cell.col].renderMode = "BRIDGE";
  }
  for (const along of [1, 6]) {
    for (const across of [3, 4]) {
      const col = horizontal ? along : across;
      const row = horizontal ? across : along;
      map.grid[row][col] = 2;
      map.heightmap[row][col] = 2;
    }
  }
  MapObjectDefinitions.prepare(map);
  BridgeDefinitions.populate(map);

  return {
    bridge,
    map,
  };
}

/**
 * @param {import("../../../../../src/game/GameContracts.js").GameMapData} map
 */
function physicsMesh(map) {
  let mesh;
  const pc = {
    Entity: class {
      tags = { add: () => {} };
      addComponent(name, options) {
        this[name] = options;
      }
      destroy() {}
    },
    Mesh: class {
      constructor() {
        mesh = this;
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
    mapData: map,
    collisionWorld: null,
  });

  return {
    mesh,
    surface,
  };
}

/**
 * @param {{positions: number[], indices: number[]}} mesh
 * @param {number} x
 * @param {number} z
 * @returns {number|null}
 */
function meshHeightAt(mesh, x, z) {
  let height = null;
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const [a, b, c] = mesh.indices.slice(index, index + 3)
      .map((vertex) => mesh.positions.slice(vertex * 3, vertex * 3 + 3));
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 0.000001) {
      continue;
    }
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    const w = 1 - u - v;
    if (Math.min(u, v, w) < -0.000001) {
      continue;
    }
    const sample = u * a[1] + v * b[1] + w * c[1];
    height = height === null ? sample : Math.max(height, sample);
  }

  return height;
}

for (const horizontal of [false, true]) {
  const axis = horizontal ? "X" : "Z";
  it(`keeps the ${axis} arch shallow, symmetric, linear within stations, and flush at banks`, () => {
    const { bridge, map } = fixture(horizontal);
    const { span } = bridge;
    assert.equal(BridgeProfile.rise(span, 1.5), 0);
    assert.equal(BridgeProfile.rise(span, 5.5), 0);
    assert.equal(BridgeProfile.rise(span, -10), 0);
    assert.equal(BridgeProfile.rise(span, 20), 0);
    assert.ok(BridgeProfile.rise(span, span.center) > 0.2);
    assert.ok(BridgeProfile.rise(span, span.center) <= 0.32);
    for (let along = span.start - 0.5; along <= span.center; along += 0.25) {
      assert.ok(Math.abs(BridgeProfile.rise(span, along) -
        BridgeProfile.rise(span, 2 * span.center - along)) < 0.000001);
    }
    assert.ok(Math.abs(BridgeProfile.rise(span, 2) -
      (BridgeProfile.rise(span, 1.5) + BridgeProfile.rise(span, 2.5)) / 2) < 0.000001);
    for (const cell of span.cells) {
      assert.equal(map.heightmap[cell.row][cell.col], 2);
      assert.equal(map.tileMeta[cell.row][cell.col].bridgeProfile.floating, false);
    }
  });

  for (const floating of [false, true]) {
    const style = floating ? "floating deck" : "arch";
    it(`matches the ${axis} ${style} hero support to real physics triangles and removes both on collapse`, () => {
      const { bridge, map } = fixture(horizontal, floating);
      const terrain = new HeroTerrain(map, null, []);
      const { mesh, surface } = physicsMesh(map);
      for (const cell of bridge.span.cells) {
        const profile = map.tileMeta[cell.row][cell.col].bridgeProfile;
        assert.equal(profile.floating, floating);
        for (const dc of [-0.5, 0.5]) {
          for (const dr of [-0.5, 0.5]) {
            const expected = BridgeProfile.heightAt(profile, cell.col + dc, cell.row + dr);
            assert.ok(Math.abs(meshHeightAt(mesh, cell.col + dc - 3.5,
              cell.row + dr - 3.5) - expected) < 0.000001);
          }
        }
        for (const offset of [-0.5, -0.27, 0.13, 0.5]) {
          const gridCol = cell.col + (horizontal ? offset : 0.11);
          const gridRow = cell.row + (horizontal ? 0.11 : offset);
          const x = gridCol - 3.5;
          const z = gridRow - 3.5;
          const expected = BridgeProfile.heightAt(profile, gridCol, gridRow);
          assert.ok(Math.abs(terrain.supportHeightAtPoint(x, z, 3) - expected) < 0.000001);
          assert.ok(Math.abs(meshHeightAt(mesh, x, z) - expected) < 0.000001);
        }
      }
      surface.destroy();
      for (const cell of bridge.span.cells) {
        const metadata = map.tileMeta[cell.row][cell.col];
        metadata.bridgeCollapsed = true;
        if (!floating) {
          metadata.bridgeGroundHeight = 0.5;
        }
      }
      const collapsed = physicsMesh(map);
      for (const cell of bridge.span.cells) {
        const x = cell.col + 0.13 - 3.5;
        const z = cell.row + 0.11 - 3.5;
        const expected = floating ? null : 0.5;
        assert.equal(terrain.supportHeightAtPoint(x, z, 3), expected);
        assert.equal(meshHeightAt(collapsed.mesh, x, z), expected);
      }
      collapsed.surface.destroy();
    });
  }
}

it("classifies only intersecting connector spans as floating, including a single touching lane", () => {
  const { bridge, map } = fixture(true);
  assert.equal(BridgeProfile.isFloating(bridge, map), false);
  map.islandConnectorData.cells = [bridge.span.cells[0]];
  assert.equal(BridgeProfile.isFloating(bridge, map), true);
  map.islandConnectorData.cells = [{
    col: bridge.span.start,
    row: 2,
  }];
  assert.equal(BridgeProfile.isFloating(bridge, map), false);
});

/**
 * @param {Map<string, Set<string>>} graph
 * @param {string} start
 * @param {string} end
 * @returns {boolean}
 */
function connected(graph, start, end) {
  const seen = new Set([start]);
  const pending = [start];
  for (let index = 0; index < pending.length; index++) {
    for (const neighbor of graph.get(pending[index]) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        pending.push(neighbor);
      }
    }
  }

  return seen.has(end);
}

for (const horizontal of [false, true]) {
  it(`follows the ${horizontal ? "X" : "Z"} arch in navigation and counts the entire fallen arch as one six-station gap`, () => {
    const cols = horizontal ? 10 : 2;
    const rows = horizontal ? 2 : 10;
    const map = {
      cols,
      rows,
      grid: Array.from({ length: rows }, () => Array(cols).fill(2)),
      heightmap: Array.from({ length: rows }, () => Array(cols).fill(2)),
      tileMeta: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
        direction: horizontal ? "EAST" : "SOUTH",
      }))),
      objects: [],
    };
    for (let along = 2; along <= 7; along++) {
      for (let across = 0; across < 2; across++) {
        map.tileMeta[horizontal ? across : along][horizontal ? along : across].renderMode = "BRIDGE";
      }
    }
    TerrainBlockDefinitions.populate(map);
    WalkingPaths.rebuild(map);
    const bridge = map.objects.find((definition) => definition.object === "Bridge");
    assert.ok(bridge);
    assert.equal(bridge.span.length, 6);
    let raisedPoints = 0;
    for (const point of map.enemyNavigation.points.values()) {
      const along = horizontal ? point.col : point.row;
      if (along >= 1.5 && along <= 7.5) {
        const expected = bridge.elevation + BridgeProfile.rise(bridge.span, along);
        assert.ok(Math.abs(point.elevation - expected) < 0.000001);
        raisedPoints += Number(point.elevation > bridge.elevation);
      }
    }
    assert.ok(raisedPoints > 3);
    const start = horizontal ? "0,1,2" : "1,0,2";
    const end = horizontal ? "18,1,2" : "1,18,2";
    assert.equal(connected(map.enemyNavigation.graphs.get(ENEMY_TRAVERSAL.WALKING), start, end), true);
    for (const cell of bridge.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
    WalkingPaths.rebuild(map);
    const { gaps, graphs } = map.enemyNavigation;
    assert.equal(gaps.length, 12);
    assert.ok(new Set(gaps.map((gap) => gap.elevation)).size > 1);
    for (const gap of gaps) {
      assert.equal(EnemyPaths.gapLength(gaps, gap), 6);
    }
    assert.equal(connected(graphs.get(ENEMY_TRAVERSAL.WALKING), start, end), false);
    assert.equal(connected(graphs.get(ENEMY_TRAVERSAL.JUMPING), start, end), false);
    assert.equal(connected(graphs.get(ENEMY_TRAVERSAL.FLYING), start, end), true);
  });
}

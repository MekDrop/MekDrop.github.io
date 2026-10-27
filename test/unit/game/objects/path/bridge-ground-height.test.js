import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { BridgeDefinitions } from "../../../../../src/game/objects/path/BridgeDefinitions.js";
import { TerrainBlockDefinitions } from "../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { TerrainPhysicsSurface } from "../../../../../src/game/collision/TerrainPhysicsSurface.js";
import { HeroTerrain } from "../../../../../src/game/objects/characters/hero/HeroTerrain.js";

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
      update() {} destroy() {}
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
 * @param {{positions:number[],indices:number[]}} mesh
 * @param {number} x
 * @param {number} z
 * @param {number} height
 */
function containsTop(mesh, x, z, height) {
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const triangle = mesh.indices.slice(index, index + 3).map((vertex) => mesh.positions.slice(vertex * 3, vertex * 3 + 3));
    const atHeight = (point) => Math.abs(point[1] - height) < 0.000001;
    if (!triangle.every(atHeight)) {
      continue;
    }
    const signs = triangle.map((point, edge) => {
      const next = triangle[(edge + 1) % 3];

      return (next[0] - point[0]) * (z - point[2]) - (next[2] - point[2]) * (x - point[0]);
    });
    if (Math.min(...signs) >= -0.000001 || Math.max(...signs) <= 0.000001) {
      return true;
    }
  }

  return false;
}

function fixture() {
  const span = {
    horizontal: true,
    start: 0,
    end: 0,
    length: 1,
    center: 0,
    crossCenter: 0.5,
    cells: [{
      col: 0,
      row: 0,
    }, {
      col: 0,
      row: 1,
    }],
  };

  return {
    cols: 1,
    rows: 2,
    grid: [[2], [2]],
    heightmap: [[2], [2]],
    tileMeta: [[{ renderMode: "BRIDGE" }], [{ renderMode: "BRIDGE" }]],
    objects: [],
    renderCommands: [
      {
        method: "addSpan",
        args: [span, 2, "timber", 1, 2],
      },
      {
        method: "addBoxMatrix",
        args: ["path", "timber", 0, 1.88, 0, 0, 1, 0.24, 2, "surfaceOnly", "none"],
      },
    ],
  };
}

it("derives zero-height support from the actual populated underside of the bridge test map", () => {
  const map = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/bridge-collapse.json", import.meta.url), "utf8"));
  TerrainBlockDefinitions.populate(map);
  const cells = map.objects.filter((definition) => definition.object === "Bridge").flatMap((definition) => definition.span.cells);
  for (const cell of cells) {
    assert.equal(map.tileMeta[cell.row][cell.col].bridgeGroundHeight, 0);
    map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
  }
  const terrain = new HeroTerrain(map, null, []);
  const { mesh, surface } = physicsMesh(map);
  for (const cell of cells) {
    const x = cell.col - (map.cols - 1) / 2;
    const z = cell.row - (map.rows - 1) / 2;
    assert.equal(terrain.supportHeightAtPoint(x, z, 3), 0);
    assert.equal(containsTop(mesh, x + 0.11, z + 0.13, 0), true);
  }
  surface.destroy();
});

it("keeps an unauthored void empty and never mistakes the transferred deck for ground", () => {
  const map = fixture();
  BridgeDefinitions.populate(map);
  map.tileMeta[0][0].bridgeCollapsed = true;
  assert.equal(map.tileMeta[0][0].bridgeGroundHeight, undefined);
  assert.equal(new HeroTerrain(map, null, []).supportHeightAtPoint(0, -0.5, 3), null);
  const { mesh, surface } = physicsMesh(map);
  assert.equal(containsTop(mesh, 0.1, -0.4, 0), false);
  assert.equal(containsTop(mesh, 0.1, -0.4, 2), false);
  surface.destroy();
});

it("indexes remaining riverbed commands, preserves explicit ground, and supports negative authored floors", () => {
  const map = fixture();
  map.tileMeta[1][0].bridgeGroundHeight = 1.2;
  map.renderCommands.push({
    method: "addBoxMatrix",
    args: ["earth", "earth", 0, -1.25, 0, 0, 1, 0.5, 2, "full", "earth"],
  });
  map.objects.push({
    object: "Earth",
    geometry: {
      method: "addCubeMatrix",
      args: ["earth", "earth", 0, 4.5, -0.5, "full", "earth"],
    },
  });
  BridgeDefinitions.populate(map);
  assert.equal(map.tileMeta[0][0].bridgeGroundHeight, -1);
  assert.equal(map.tileMeta[1][0].bridgeGroundHeight, 1.2);
  map.tileMeta[0][0].bridgeCollapsed = true;
  assert.equal(new HeroTerrain(map, null, []).supportHeightAtPoint(0, -0.5, 3), -1);
  const { mesh, surface } = physicsMesh(map);
  assert.equal(containsTop(mesh, 0.1, -0.4, -1), true);
  surface.destroy();
});

it("samples the real top plane of rotated and pitched underlying boxes", () => {
  const map = fixture();
  map.renderCommands.push({
    method: "addBoxMatrix",
    args: ["earth", "earth", 0, 0, 0, 90, 2, 0.2, 2, "full", "earth", 15],
  });
  BridgeDefinitions.populate(map);
  assert.ok(Math.abs(map.tileMeta[0][0].bridgeGroundHeight - 0.1 / Math.cos(Math.PI / 12)) < 0.000001);
});

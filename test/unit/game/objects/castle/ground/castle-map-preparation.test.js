import { MapGenerator } from "../../../../../../src/game/generator/map/MapGenerator.js";
import { TerrainBlockDefinitions } from "../../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { createCastleGroundCuts } from "../../../../../../src/game/objects/castle/ground/CastleGroundCuts.js";
import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleMapPreparation } from "../../../../../../src/game/objects/castle/ground/CastleMapPreparation.js";
import { GrassCarpetLayout } from "../../../../../../src/game/objects/ground-cover/GrassCarpetLayout.js";
import { TileType } from "../../../../../../src/game/generator/map/MapGenerator.js";

it("terraces exposed mirrored castle lawns while preserving roads and repeat preparation", async () => {
  const map = await MapGenerator.generate({ mapName: "43" });
  TerrainBlockDefinitions.populate(map);
  const before = map.heightmap.map(row => [...row]);
  CastleMapPreparation.prepareMap(map);
  const terraces = [];
  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.cols; col += 1) {
      if ([TileType.PATH, TileType.ENTRY].includes(map.grid[row][col])) {
        assert.equal(map.heightmap[row][col], before[row][col]);
      }
      if (!map.tileMeta[row][col].castleWeathered) {
        continue;
      }
      terraces.push([col, row]);
      assert.equal(map.heightmap[row][col], before[row][col] - 1);
      assert.ok(map.objects.some(record => record.object === "Grass" &&
        record.tile?.col === col && record.tile?.row === row &&
        record.position.y + 0.5 === map.heightmap[row][col]));
    }
  }
  assert.ok(terraces.length > 5, "the reserved lawn has visible terrain variation");
  const heights = map.heightmap.map(row => [...row]);
  CastleMapPreparation.prepareMap(map);
  assert.deepEqual(map.heightmap, heights);
});

it("grows blades on exposed foundation turf outside excavation cuts", () => {
  const map = {
    cols: 1,
    rows: 1,
    grid: [[TileType.CASTLE_WALL]],
    heightmap: [[2]],
    tileMeta: [[{ surfaceType: "STRUCTURE" }]],
    objects: [{
      object: "Grass",
      generated: true,
      tile: {
        col: 0,
        row: 0,
      },
      position: {
        x: 0,
        y: 1.5,
        z: 0,
      },
    }],
  };
  CastleMapPreparation.prepareMap(map);
  assert.equal(map.tileMeta[0][0].exposedTerrain, true);
  assert.equal(GrassCarpetLayout.create(map).length, 72);
});
it("supports raised castles without residential metadata up to their wall base", async () => {
  const plan = await CastleGenerator.generate({
    position: {
      x: -4,
      z: -4,
      width: 8,
      depth: 8,
      elevation: 4,
    },
    doors: [{
      side: "WEST",
      offset: 3,
      width: 2,
      approachElevation: 1,
    }],
    style: "courtyard-keep",
  });
  const map = {
    cols: 16,
    rows: 16,
    grid: Array.from({ length: 16 }, () => Array(16).fill(1)),
    heightmap: Array.from({ length: 16 }, () => Array(16).fill(1)),
    objects: [{
      object: "Castle",
      buildPlan: plan,
    }],
  };
  CastleMapPreparation.prepareMap(map);
  assert.equal(map.heightmap[4][4], 4);
  const support = map.objects.filter((record) => record.tile?.col === 4 && record.tile?.row === 4);
  assert.ok(support.length > 0);
  assert.equal(Math.max(...support.map((record) => record.position.y + 0.5)), 4);
  assert.equal(map.heightmap[0][0], 1, "Distant terrain retains its elevation");
});

it("removes map 43 plants intersecting mirrored walls and basement while preserving distant plants", async () => {
  const map = await MapGenerator.generate({ mapName: "43" });
  TerrainBlockDefinitions.populate(map);
  assert.ok(map.groundCoverData.some(d => d.col === 37 && d.row === 21 && d.variant === "red-mushroom"));
  const originalTrees = map.objects.filter(o => o.object === "Vegetation");
  const castle = map.objects.find(o => o.object === "Castle");
  const cuts = createCastleGroundCuts(castle.buildPlan, new CastleResidentialLayout(castle.buildPlan));
  const intrudes = (plant) => cuts.some(c =>
    plant.position.x + .75 > c.minX && plant.position.x - .75 < c.maxX &&
    plant.position.z + .75 > c.minZ && plant.position.z - .75 < c.maxZ &&
    plant.position.y + 2 > c.minY && plant.position.y < c.maxY);
  assert.ok(originalTrees.some(intrudes), "reproduces foliage occupying the basement");
  CastleMapPreparation.prepareMap(map);
  assert.ok(!map.groundCoverData.some(d => d.col === 37 && d.row === 21));
  const trees = map.objects.filter(o => o.object === "Vegetation");
  assert.ok(trees.length > 0 && trees.length < originalTrees.length);
  assert.ok(trees.every(plant => !intrudes(plant)));
  const retained = trees.map(o => o.id);
  assert.ok(originalTrees.filter(plant => !intrudes(plant)).every(plant => retained.includes(plant.id)));
  assert.ok(map.groundCoverData.some(d => d.variant.includes("mushroom")));
  assert.ok(map.groundCoverData.some(d => d.variant.includes("patch")));
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleMapPreparation } from "../../../../../src/game/objects/castle/CastleMapPreparation.js";
import { GrassCarpetLayout } from "../../../../../src/game/objects/ground-cover/GrassCarpetLayout.js";
import { TileType } from "../../../../../src/game/generator/map/MapGenerator.js";

it("grows blades on exposed foundation turf outside excavation cuts", () => {
  const map = {
    cols: 1,
    rows: 1,
    grid: [[TileType.CASTLE_WALL]],
    heightmap: [[2]],
    tileMeta: [[{ surfaceType: "STRUCTURE" }]],
    objects: [{ object: "Grass", generated: true, tile: { col: 0, row: 0 },
      position: { x: 0, y: 1.5, z: 0 } }],
  };
  CastleMapPreparation.prepareMap(map);
  assert.equal(map.tileMeta[0][0].exposedTerrain, true);
  assert.equal(GrassCarpetLayout.create(map).length, 72);
});
it("supports raised castles without residential metadata up to their wall base", async () => {
  const plan = await CastleGenerator.generate({
    position: { x: -4, z: -4, width: 8, depth: 8, elevation: 4 },
    doors: [{ side: "WEST", offset: 3, width: 2, approachElevation: 1 }],
    style: "courtyard-keep",
  });
  const map = {
    cols: 16,
    rows: 16,
    grid: Array.from({ length: 16 }, () => Array(16).fill(1)),
    heightmap: Array.from({ length: 16 }, () => Array(16).fill(1)),
    objects: [{ object: "Castle", buildPlan: plan }],
  };
  CastleMapPreparation.prepareMap(map);
  assert.equal(map.heightmap[4][4], 4);
  const support = map.objects.filter((record) => record.tile?.col === 4 && record.tile?.row === 4);
  assert.ok(support.length > 0);
  assert.equal(Math.max(...support.map((record) => record.position.y + 0.5)), 4);
  assert.equal(map.heightmap[0][0], 1, "Distant terrain retains its elevation");
});

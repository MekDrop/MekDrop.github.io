import assert from "node:assert/strict";
import { it } from "node:test";
import { clipCastleTerrainRecord } from "../../../../../../src/game/objects/castle/ground/CastleGroundCuts.js";
import { GRASS_SURFACE_LIFT } from "../../../../../../src/game/config/terrain.js";
import { SURFACE_ELEVATION_BIAS } from "../../../../../../src/game/rendering/terrain/TerrainMaterialMaps.js";

it("keeps trimmed lawn coplanar with intact grass, including shallow remnants", () => {
  const terrain = {
    id: "lawn",
    object: "Grass",
    position: {
      x: 0,
      y: 2.5,
      z: 0,
    },
    geometry: {
      method: "addCubeMatrix",
      args: ["grass", "earth", 0, 2.5, 0, "full", "earth", GRASS_SURFACE_LIFT],
    },
  };
  const expectedTop = 3 + GRASS_SURFACE_LIFT + SURFACE_ELEVATION_BIAS * (1 + GRASS_SURFACE_LIFT);
  for (const cut of [
    {
      minX: 0,
      maxX: 1,
      minY: 2,
      maxY: 4,
      minZ: -1,
      maxZ: 1,
    },
    {
      minX: -1,
      maxX: 1,
      minY: 2,
      maxY: 2.8,
      minZ: -1,
      maxZ: 1,
    },
  ]) {
    const pieces = clipCastleTerrainRecord(terrain, [cut]);
    assert.ok(pieces.length > 0);
    for (const piece of pieces) {
      const height = piece.geometry.args[7];
      const renderedTop = piece.position.y + height * (0.5 + SURFACE_ELEVATION_BIAS);
      assert.ok(Math.abs(renderedTop - expectedTop) < 1e-10);
      const expectedBottom = cut.maxY < 3 ? cut.maxY : 2;
      assert.ok(Math.abs(piece.position.y - height / 2 - expectedBottom) < 1e-10);
    }
  }
});
it("preserves paving on the surviving part of a path tile beside a castle sill", () => {
  const terrain = {
    id: "path",
    object: "Earth",
    position: {
      x: 0.5,
      y: 1.5,
      z: 5.5,
    },
    geometry: {
      method: "addCubeMatrix",
      args: ["surface:22:27:1", "earthSide:22:27:1", 0.5, 1.5, 5.5, "full", "none", 0],
    },
  };
  const pieces = clipCastleTerrainRecord(terrain, [{
    minX: -1,
    maxX: 1,
    minZ: 4.875,
    maxZ: 5.125,
    minY: 1.75,
    maxY: 100,
  }]);
  const path = pieces.find(piece => piece.position.z > 5.125 && piece.position.y + piece.geometry.args[7] / 2 === 2);
  assert.ok(path);
  assert.equal(path.geometry.args[0], "surface:22:27:1");
  assert.ok(pieces.some(piece => piece.geometry.args[0] === "earth"));
});

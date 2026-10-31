import assert from "node:assert/strict";
import { it } from "node:test";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { PathOverpassCollider } from "../../../../../src/game/collision/PathOverpassCollider.js";
import { PathSurfaceValidator } from "../../../../../src/game/generator/map/PathSurfaceValidator.js";
import { InvalidOverpassError } from "../../../../../src/game/errors/map/index.js";

it("excavates a connected two-lane underpass beneath a level road", async () => {
  const map = await MapGenerator.generate({
    mapName: "variant-2",
    numPaths: 4,
    numRivers: 0,
    underpass: true,
    islandConnectors: false,
  });
  const plan = map.overpassData;
  assert.equal(plan.underpass, true);
  assert.equal(plan.deckElevation, 2);
  assert.equal(plan.baseElevation, 0);
  assert.equal(plan.lowerSlopeCells.length, 16);
  assert.equal(plan.raisedTerrainCells.length, 0);
  for (const cell of plan.lowerSlopeCells) {
    assert.equal(map.grid[cell.row][cell.col], 2);
    assert.equal(cell.highHeight - cell.lowHeight, 0.5);
    assert.equal(map.heightmap[cell.row][cell.col], (cell.lowHeight + cell.highHeight) / 2);
    assert.equal(map.tileMeta[cell.row][cell.col].renderMode, "SOLID");
  }
  for (const cell of plan.crossingCells) {
    assert.equal(map.heightmap[cell.row][cell.col], 0);
    assert.equal(map.tileMeta[cell.row][cell.col].overpass.elevation, 2);
  }
  for (const path of map.paths) {
    assert.ok(path.route.length > 0);
  }
  const lower = map.paths[plan.lowerPathIdx].route;
  assert.equal(lower[0].elevation, 2);
  assert.ok(lower.some(point => point.elevation === 0));
  assert.equal(lower.at(-1).elevation, 2);
  assert.ok(map.paths[plan.upperPathIdx].route.every(point => point.elevation === 2));
  const collider = new PathOverpassCollider({
    overpass: plan,
    cols: map.cols,
    rows: map.rows,
  });
  const x = plan.crossing.col + 0.5 - (map.cols - 1) / 2;
  const z = plan.crossing.row + 0.5 - (map.rows - 1) / 2;
  assert.equal(collider.blocksMovementAt(x, z, 0.2, 0, 0.4), false);
  assert.equal(collider.surfaceHeightAt(x, z), 2);
  assert.equal(collider.ceilingHeightAt(x, z), 2 - plan.deckThickness);
  const cell = plan.lowerSlopeCells[0];
  map.tileMeta[cell.row][cell.col].slope.highHeight += 0.5;
  assert.throws(() => new PathSurfaceValidator().validateOverpass(
    map.grid, map.heightmap, map.tileMeta, plan,
  ), InvalidOverpassError);
});

it("can retain the raised crossing for the same layout", async () => {
  const map = await MapGenerator.generate({
    mapName: "variant-2",
    numPaths: 4,
    numRivers: 0,
    overpass: true,
    underpass: false,
  });
  assert.ok(map.overpassData);
  assert.equal(map.overpassData.underpass, undefined);
  assert.equal(map.overpassData.deckElevation, 4);
});

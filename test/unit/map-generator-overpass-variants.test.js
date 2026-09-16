import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MapGenerator } from "../../src/game/MapGenerator.js";

describe("MapGenerator overpass variants", () => {
  it("raises the entry route and plateau without making the route climb", () => {
    const map = MapGenerator.generate({
      mapName: "variant-4",
      numPaths: 4,
      numRivers: 0,
      overpass: true,
    });
    const overpass = map.overpassData;

    assert.equal(overpass.raisedEntryApproach, true);
    assert.ok(overpass.raisedApproachCells.length > 0);
    assert.ok(overpass.raisedTerrainCells.length > 0);
    assert.equal(overpass.slopeCells.length, 8);

    const entry = map.entries[overpass.upperPathIdx];
    assert.equal(
      map.heightmap[entry.rows[0]][entry.col],
      overpass.deckElevation,
    );
    for (const cell of overpass.raisedTerrainCells) {
      assert.equal(
        map.heightmap[cell.row][cell.col],
        overpass.deckElevation,
      );
    }

    const route = map.paths[overpass.upperPathIdx].route;
    assert.equal(route[0].elevation, overpass.deckElevation);
    for (let index = 1; index < route.length; index += 1) {
      assert.ok(route[index].elevation <= route[index - 1].elevation);
    }
  });

  it("selects castle-style stair approaches deterministically", () => {
    const map = MapGenerator.generate({
      mapName: "variant-2",
      numPaths: 4,
      numRivers: 0,
      overpass: true,
    });

    assert.equal(map.overpassData.stairApproach, true);
    assert.ok(map.overpassData.slopeCells.length > 0);
  });
});

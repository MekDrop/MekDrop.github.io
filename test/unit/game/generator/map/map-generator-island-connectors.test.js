import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { SkyIslandScenery } from "../../../../../src/game/objects/scenery/SkyIslandScenery.js";

describe("island connector generation", () => {
  it("opens the pictured land neck while keeping a two-lane walkable bridge", async () => {
    const map = await MapGenerator.generate({ mapName: "muk76amh_1dmmup1" });
    const connector = map.islandConnectorData;

    assert.ok(connector);
    assert.deepEqual(connector.removedCells, [
      { col: 18, row: 13 },
      { col: 21, row: 13 },
      { col: 22, row: 13 },
    ]);
    for (const { col, row } of connector.removedCells) {
      assert.equal(map.grid[row][col], 0);
    }
    for (const { col, row } of connector.cells) {
      assert.equal(map.grid[row][col], 2);
      assert.equal(map.tileMeta[row][col].renderMode, "BRIDGE");
      assert.equal(map.tileMeta[row][col].bridgeGroundHeight, null);
    }
    const underside = new SkyIslandScenery(map).createUndersideVoxels();
    assert.ok(underside.some(({ col, row }) => col === 19 && row === 12));
    assert.ok(underside.some(({ col, row }) => col === 19 && row === 14));
    assert.ok(underside.every(({ col, row }) =>
      !connector.cells.some((cell) => cell.col === col && cell.row === row)));
    assert.ok(connector.nearIsland.length > 100);
    assert.ok(connector.farIsland.length > 100);
    assert.ok(connector.nearIsland.includes("19,8"));
    for (const { col, row } of connector.cells) {
      assert.ok(connector.nearIsland.includes(`${col},${row}`));
      assert.ok(!connector.farIsland.includes(`${col},${row}`));
    }
  });

  it("preserves the original seeded layout when connectors are disabled", async () => {
    const map = await MapGenerator.generate({
      mapName: "muk76amh_1dmmup1",
      islandConnectors: false,
    });

    assert.equal(map.islandConnectorData, undefined);
    assert.equal(map.grid[13][18], 1);
    assert.equal(map.grid[13][21], 1);
  });
});

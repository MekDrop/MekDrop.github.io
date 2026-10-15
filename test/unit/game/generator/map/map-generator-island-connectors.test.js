import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { SkyIslandScenery } from "../../../../../src/game/objects/scenery/SkyIslandScenery.js";
import { GenerationRandom } from "../../../../../src/game/generator/map/GenerationRandom.js";
import { IslandCellOwnership } from "../../../../../src/game/objects/shared/IslandCellOwnership.js";

describe("island connector generation", () => {
  it("keeps the reported seed's raised grass connected to its hillside", async () => {
    const map = await MapGenerator.generate({ mapName: "muk76amh_1dmmup1" });
    assert.ok(map.islandConnectorData);
    const connectors = map.islandConnectorData.connectors;
    assert.equal(connectors.length, 2, "the reported seed must not be sliced into repeated bridge slivers");
    const straightRuns = connectors.map((connector) => {
      const cell = connector.cells[0];
      return `${connector.horizontal}:${connector.horizontal ? cell.row : cell.col}`;
    });
    assert.equal(new Set(straightRuns).size, connectors.length);

    const unsplit = await MapGenerator.generate({
      mapName: "muk76amh_1dmmup1",
      islandConnectors: false,
    });
    for (const connector of connectors) {
      for (const cell of connector.cells) {
        for (const step of [-1, 0, 1]) {
          const col = cell.col + (connector.horizontal ? step : 0);
          const row = cell.row + (connector.horizontal ? 0 : step);
          assert.notEqual(unsplit.tileMeta[row][col].renderMode, "BRIDGE", "splits must not cut into or extend an existing bridge");
        }
      }
    }
    const groups = new IslandCellOwnership(map).groups;
    for (const { method, args } of map.renderCommands) {
      if (method !== "addSpan") continue;
      const owners = args[0].cells.map(({ col, row }) => groups.findIndex((cells) => cells.has(`${col},${row}`)));
      assert.ok(owners[0] >= 0);
      assert.equal(new Set(owners).size, 1, "deck tiles and continuous rails must move as one span");
    }
  });

  it("generates three connected islands with complete, disjoint motion ownership", async () => {
    const map = await MapGenerator.generate({ mapName: "multi-islands-37" });
    const data = map.islandConnectorData;
    assert.equal(data.islands.length, 3);
    assert.equal(data.connectors.length, 2);
    const groups = new IslandCellOwnership(map).groups;
    const owned = groups.flatMap((cells) => [...cells]);
    assert.equal(new Set(owned).size, owned.length);
    for (const connector of data.connectors) {
      assert.equal(connector.cells.length, 2);
      assert.ok(connector.removedCells.length + connector.cells.length <= 7);
      for (const { col, row } of connector.removedCells) assert.equal(map.grid[row][col], 0);
      const owners = connector.cells.map(({ col, row }) => groups.findIndex((cells) => cells.has(`${col},${row}`)));
      assert.ok(owners[0] >= 0);
      assert.equal(owners[0], owners[1]);
    }
    const underside = new SkyIslandScenery(map).createUndersideVoxels();
    assert.ok(underside.every(({ col, row }) => !data.cells.some((cell) => cell.col === col && cell.row === row)));
    assert.deepEqual((await MapGenerator.generate({ mapName: "multi-islands-37" })).islandConnectorData, data);
  });

  it("keeps connector generation optional", async () => {
    const map = await MapGenerator.generate({
      mapName: "multi-islands-37",
      islandConnectors: false,
    });
    assert.equal(map.islandConnectorData, undefined);
  });

  it("preserves the map-wide seventy-percent probability gate", async () => {
    assert.equal(new GenerationRandom().deterministicChance("multi-islands-0", "split-island", 70), false);
    const map = await MapGenerator.generate({ mapName: "multi-islands-0" });
    assert.equal(map.islandConnectorData, undefined);
  });
});

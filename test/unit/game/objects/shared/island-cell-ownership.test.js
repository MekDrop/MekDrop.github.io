import assert from "node:assert/strict";
import { it } from "node:test";
import { IslandCellOwnership } from "../../../../../src/game/objects/shared/IslandCellOwnership.js";

it("assigns complete rivers, including covered sources, to their adjacent bank", () => {
  const connector = { nearIsland: ["0,1"], farIsland: ["9,1"] };
  const ownership = new IslandCellOwnership({
    islandConnectorData: connector,
    riverData: [
      { cells: [{ col: 3, row: 1 }, { col: 2, row: 1 }, { col: 1, row: 1 }] },
      { cells: [{ col: 7, row: 1 }, { col: 8, row: 1 }] },
      { cells: [{ col: 5, row: 5 }] },
    ],
  });
  assert.deepEqual([...ownership.groups[0]], ["0,1", "3,1", "2,1", "1,1"]);
  assert.deepEqual([...ownership.groups[1]], ["9,1", "7,1", "8,1"]);
  assert.deepEqual(connector, { nearIsland: ["0,1"], farIsland: ["9,1"] });
  assert.ok(ownership.groups.every(cells => !cells.has("5,5")));
});

it("preserves land ownership when there are no rivers or no connector", () => {
  assert.deepEqual(new IslandCellOwnership({}).groups, []);
  const ownership = new IslandCellOwnership({
    islandConnectorData: { nearIsland: ["1,1"], farIsland: ["3,3"] },
  });
  assert.deepEqual(ownership.groups, [new Set(["1,1"]), new Set(["3,3"])]);
});

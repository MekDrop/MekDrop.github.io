import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { TerrainBlockDefinitions } from "../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { HeroTerrain } from "../../../../../src/game/objects/characters/hero/HeroTerrain.js";
import { IslandCellOwnership } from "../../../../../src/game/objects/shared/IslandCellOwnership.js";

it("keeps the floating style fixture over a true void while normal bridges retain ground", () => {
  const map = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/bridge-styles.json", import.meta.url), "utf8"));
  TerrainBlockDefinitions.populate(map);
  const bridges = map.objects.filter((definition) => definition.object === "Bridge");
  const floating = bridges.find((definition) => definition.id === "bridge-x-5-17.5-2");
  assert.ok(floating);
  assert.equal(bridges.length, 3);
  const ownership = new IslandCellOwnership(map).groups;
  for (const cell of floating.span.cells) {
    const metadata = map.tileMeta[cell.row][cell.col];
    assert.equal(metadata.islandConnector, true);
    assert.equal(metadata.bridgeGroundHeight, undefined);
    assert.equal(ownership[0].has(`${cell.col},${cell.row}`), true);
    metadata.bridgeCollapsed = true;
  }
  const terrain = new HeroTerrain(map, null, []);
  for (const cell of floating.span.cells) {
    assert.equal(terrain.supportHeightAtPoint(cell.col - (map.cols - 1) / 2,
      cell.row - (map.rows - 1) / 2, 3), null);
  }
  for (const bridge of bridges) {
    if (bridge === floating) {
      continue;
    }
    for (const cell of bridge.span.cells) {
      assert.equal(map.tileMeta[cell.row][cell.col].bridgeGroundHeight, 0);
    }
  }
  assert.equal(map.testControls.panels[0].statusTargetId, "bridge-x-6-10.5-2");
  assert.equal(map.testControls.panels[1].statusTargetId, floating.id);
});

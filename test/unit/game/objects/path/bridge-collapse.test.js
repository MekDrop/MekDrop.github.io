import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { BridgeDefinitions } from "../../../../../src/game/objects/path/BridgeDefinitions.js";
import { BridgeInteraction } from "../../../../../src/game/objects/path/BridgeInteraction.js";
import { TerrainBlockDefinitions } from "../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { HeroTerrain } from "../../../../../src/game/objects/characters/hero/HeroTerrain.js";

const fixtureUrl = new URL("../../../../../src/game/maps/tests/bridge-collapse.json", import.meta.url);

it("materializes short and long bridges once and removes their static deck and rails", () => {
  const map = JSON.parse(readFileSync(fixtureUrl, "utf8"));
  const original = structuredClone(map.grid);
  TerrainBlockDefinitions.populate(map);
  const bridges = map.objects.filter(({ object }) => object === "Bridge");
  assert.deepEqual(bridges.map(({ span }) => span.length).sort((a, b) => a - b), [1, 3, 6]);
  assert.ok(bridges.every(({ span }) => span.cells.length === span.length * 2));
  assert.ok(!map.renderCommands.some(({ method }) => method === "addSpan"));
  assert.ok(!map.renderCommands.some(({ method, args }) => method === "addBoxMatrix" &&
    ["surfaceOnly", "bridgeHorizontalSidesOnly", "bridgeVerticalSidesOnly"].includes(args[9])));
  BridgeDefinitions.populate(map);
  TerrainBlockDefinitions.populate(map);
  assert.equal(map.objects.filter(({ object }) => object === "Bridge").length, 3);
  assert.deepEqual(map.grid, original);
});

it("starts the hammer without collapsing early, then starts the span collapse at the struck section", () => {
  let strike;
  const collapsed = [];
  let complete = 0;
  const bridge = {
    definition: { id: "test-bridge" },
    targetStation: () => 4,
    stationPosition: () => new Vec3(1, 2, 3),
    collapseStation: (station) => {
      collapsed.push(station);

      return true;
    },
  };
  const hero = {
    grounded: true,
    smashBridge: (options) => {
      strike = options;

      return true;
    },
  };
  const action = new BridgeInteraction(bridge, hero, 4, () => complete++);
  assert.equal(action.canInteract, true);
  assert.equal(action.description.labelKey, "game.interaction.smash_bridge");
  assert.equal(action.interact(), true);
  assert.deepEqual(collapsed, []);
  assert.equal(complete, 1);
  assert.equal(strike.targetX, 1);
  assert.equal(strike.targetZ, 3);
  strike.onImpact();
  assert.deepEqual(collapsed, [4]);
  hero.isUsingTool = true;
  assert.equal(action.interact(), false);
});

it("removes hero foot support at a gap while retaining the intact bank and underlying ground", () => {
  const map = {
    cols: 3,
    rows: 2,
    grid: [[2, 2, 2], [2, 2, 2]],
    heightmap: [[2, 2, 2], [2, 2, 2]],
    tileMeta: [[{}, { bridgeCollapsed: true }, {}], [{}, { bridgeCollapsed: true }, {}]],
  };
  const terrain = new HeroTerrain(map, null, []);
  assert.equal(terrain.supportHeightAtPoint(-1, -0.5, 3), 2);
  assert.equal(terrain.supportHeightAtPoint(0, -0.5, 3), null);
  assert.equal(terrain.surfaceAt(0, 0, 3), null);
  map.tileMeta[0][1].bridgeGroundHeight = 1;
  assert.equal(terrain.supportHeightAtPoint(0, -0.5, 3), 1);
});

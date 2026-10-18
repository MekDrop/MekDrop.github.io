import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import { GardenTerraceRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/terrace/GardenTerraceRoomGenerator.js";
import { CastleGenerator } from "../../../../../../../src/game/generator/castle/CastleGenerator.js";
import { LeisureRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/leisure/LeisureRoomMapObjects.js";
import { CastleGardenMapObjects } from "../../../../../../../src/game/objects/castle/rooms/terrace/CastleGardenMapObjects.js";

const room = {
  id: "terrace",
  minX: 0.25,
  maxX: 15.75,
  minZ: 7,
  maxZ: 13.25,
  floorY: 6,
  level: 1,
  height: 4,
};

it("selects reproducible paired garden/storybook seeds and keeps the tower corridor empty", () => {
  const generator = new GardenTerraceRoomGenerator();
  for (const seed of [0, 1, 2, 3, 4, 17, "garden"]) {
    const items = generator.furnish({
      ...room,
      furnishingSeed: seed,
    });
    assert.deepEqual(items, generator.furnish({
      ...room,
      furnishingSeed: seed,
    }));
    for (const item of items) {
      const half = item.width * item.scale / 2;
      assert.ok(item.x + half < 7 || item.x - half > 9,
        `${item.object} leaves the full central two-metre approach unobstructed`);
      assert.ok(item.z - item.depth * item.scale / 2 >= room.minZ);
      assert.ok(item.z + item.depth * item.scale / 2 <= room.maxZ);
    }
    const shelter = items.find(item => item.object === "GardenShelter");
    const table = items.find(item => item.object === "Table");
    assert.equal(table.supportId, shelter.id);
    assert.equal(table.underSupport, true);
    for (const item of items.filter(item => ["Teapot", "Teacup"].includes(item.object))) {
      assert.equal(item.supportId, table.id);
      assert.equal(item.elevation, table.properties.height);
    }
  }
  assert.equal(GardenTerraceRoomGenerator.styleFor(0), "royal-garden");
  assert.equal(GardenTerraceRoomGenerator.styleFor(1), "royal-garden");
  assert.equal(GardenTerraceRoomGenerator.styleFor(2), "storybook");
  assert.equal(GardenTerraceRoomGenerator.styleFor(3), "storybook");
});

it("publishes both repaired terrace styles at their actual floor/support heights and removes stale dressing", async () => {
  const map = JSON.parse(await readFile(new URL("../../../../../../../src/game/maps/tests/castle-rear-bell-tower.json", import.meta.url), "utf8"));
  const castle = map.objects.find(item => item.object === "Castle");
  let previousGeometry;
  for (const seed of [0, 2]) {
    castle.seed = seed;
    castle.buildPlan = await CastleGenerator.generate(castle);
    const residential = castle.buildPlan.metadata.runtime.residential;
    const items = residential.furniture.filter(item => item.role === "leisureProp");
    assert.equal(items.length, 13);
    assert.ok(items.every(item => !item.placementIssue));
    const terrace = residential.spaces.find(space => space.id === "terrace");
    const towerApproachX = (terrace.minX + terrace.maxX) / 2;
    assert.ok(items.every(item => Math.abs(item.x - towerApproachX) > item.width * item.scale / 2 + 1));
    const geometry = castle.buildPlan.geometry.boxes.map(({ material, ...box }) => box);
    if (previousGeometry) {
      assert.deepEqual(geometry, previousGeometry, "Only surface assignments change, never the castle structure");
    }
    previousGeometry = geometry;
    LeisureRoomMapObjects.prepareMap(map);
    CastleGardenMapObjects.prepareMap(map);
    const props = map.objects.filter(item => item.id.startsWith(`${castle.id}-leisure-`));
    assert.equal(props.length, 13);
    assert.ok(props.filter(item => ["Teapot", "Teacup"].includes(item.object))
      .every(item => Math.abs(item.position.y - 6.73) < 1e-6));
    assert.ok(props.filter(item => !["Teapot", "Teacup"].includes(item.object))
      .every(item => item.position.y === 6));
    assert.equal(props.find(item => item.object === "GardenShelter").variant, seed === 0 ? "pergola" : "canopy");
    const ivy = map.objects.filter(item => item.castleGardenDressing && item.object === "CliffVine");
    assert.equal(ivy.length, seed === 0 ? 2 : 4);
    const count = map.objects.length;
    LeisureRoomMapObjects.prepareMap(map);
    CastleGardenMapObjects.prepareMap(map);
    assert.equal(map.objects.length, count);
    assert.equal(new Set(map.objects.map(item => item.id)).size, count);
    assert.equal(castle.buildPlan.geometry.boxes.some(box => box.material === "castleTerraceBrick"), seed === 2);
  }
});

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
  for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 17, "garden"]) {
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

it("switches the entire supported seating group between bays independently of style", () => {
  const generator = new GardenTerraceRoomGenerator();
  for (const seed of [0, 2]) {
    const left = generator.furnish({
      ...room,
      furnishingSeed: seed,
    });
    const right = generator.furnish({
      ...room,
      furnishingSeed: seed + 4,
    });
    const leftShelter = left.find(item => item.object === "GardenShelter");
    const rightShelter = right.find(item => item.object === "GardenShelter");
    assert.equal(leftShelter.variant, rightShelter.variant);
    assert.ok(leftShelter.x < (room.minX + room.maxX) / 2);
    assert.ok(rightShelter.x > (room.minX + room.maxX) / 2);
    const members = left.filter(item => ["GardenShelter", "Table", "Chair", "Bench", "Teapot", "Teacup"].includes(item.object));
    for (const item of members) {
      const index = left.indexOf(item);
      const counterpart = right[index];
      assert.ok(Math.abs((counterpart.x - rightShelter.x) - (item.x - leftShelter.x)) < 1e-8);
      assert.ok(Math.abs((counterpart.z - rightShelter.z) - (item.z - leftShelter.z)) < 1e-8);
      assert.equal(counterpart.rotation, item.rotation);
      assert.equal(counterpart.supportId, item.supportId);
    }
    const opposite = right.at(-1);
    assert.ok(opposite.x < (room.minX + room.maxX) / 2,
      "the opposite-wall barrel/planter cannot collide with the moved shelter");
  }
});

it("keeps measured shelter and planter footprints outside the approach in narrower terraces", () => {
  const generator = new GardenTerraceRoomGenerator();
  for (const width of [11.1, 12, 13, 15.5]) {
    for (const seed of [0, 2, 4, 6]) {
      const bounds = {
        ...room,
        maxX: room.minX + width,
      };
      const items = generator.furnish({
        ...bounds,
        furnishingSeed: seed,
      });
      assert.ok(items.some(item => item.object === "GardenShelter"));
      for (const item of items) {
        const half = item.width * item.scale / 2;
        assert.ok(item.x - half >= bounds.minX && item.x + half <= bounds.maxX);
        assert.ok(Math.abs(item.x - (bounds.minX + bounds.maxX) / 2) >= half + 1);
      }
    }
  }
  assert.deepEqual(generator.furnish({
    ...room,
    maxX: room.minX + 10,
  }), [], "a full shelter cannot occupy an undersized bay without consuming the approach");
});

it("publishes both repaired terrace styles at their actual floor/support heights and removes stale dressing", async () => {
  const map = JSON.parse(await readFile(new URL("../../../../../../../src/game/maps/tests/castle-rear-bell-tower.json", import.meta.url), "utf8"));
  const castle = map.objects.find(item => item.object === "Castle");
  let previousGeometry;
  for (const seed of [0, 2, 4, 6]) {
    const storybook = GardenTerraceRoomGenerator.styleFor(seed) === "storybook";
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
    assert.equal(props.find(item => item.object === "GardenShelter").variant, storybook ? "canopy" : "pergola");
    const ivy = map.objects.filter(item => item.castleGardenDressing && item.object === "CliffVine");
    assert.equal(ivy.length, storybook ? 4 : 2);
    const count = map.objects.length;
    LeisureRoomMapObjects.prepareMap(map);
    CastleGardenMapObjects.prepareMap(map);
    assert.equal(map.objects.length, count);
    assert.equal(new Set(map.objects.map(item => item.id)).size, count);
    assert.equal(castle.buildPlan.geometry.boxes.some(box => box.material === "castleTerraceBrick"), storybook);
  }
});

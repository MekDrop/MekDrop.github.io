import test from "node:test";
import assert from "node:assert/strict";
import { KitchenRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/KitchenRoomGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { KitchenRoomMapObjects } from "../../../../../../src/game/objects/castle/KitchenRoomMapObjects.js";

const room = { id: "kitchen", minX: 0, maxX: 4, minZ: 0, maxZ: 3.75, floorY: -3, level: -1 };

test("kitchen varies coherently and reproduces its local seed", () => {
  const generator = new KitchenRoomGenerator();
  const first = generator.furnish(room, { seed: 2 });
  assert.deepEqual(first, generator.furnish(room, { seed: 2 }));
  const variants = new Set();
  const counts = new Set();
  for (let seed = 0; seed < 24; seed++) {
    const items = generator.furnish(room, { seed });
    variants.add(JSON.stringify(items));
    counts.add(items.length);
    const floorItems = items.filter(item => !item.y);
    for (let index = 0; index < floorItems.length; index++) {
      for (const other of floorItems.slice(index + 1)) {
        const item = floorItems[index];
        assert.ok(Math.abs(item.x - other.x) >= (item.width + other.width) / 2 ||
          Math.abs(item.z - other.z) >= (item.depth + other.depth) / 2);
      }
    }
    const table = items.find(item => item.object === "KitchenTable");
    assert.ok(table);
    for (const item of items) {
      assert.ok(item.x - item.width / 2 >= room.minX);
      assert.ok(item.x + item.width / 2 <= room.maxX);
      assert.ok(item.z - item.depth / 2 >= room.minZ);
      assert.ok(item.z + item.depth / 2 <= room.maxZ);
      // Southern west entry and the central service aisle stay traversable.
      assert.ok(!(item.x - item.width / 2 < 1.2 && item.z + item.depth / 2 > 2.4));
      if (["BowlGreenVegetables", "BowlRedFruit", "PlateBread"].includes(item.object)) {
        assert.equal(item.y, 0.564499);
        assert.ok(Math.abs(item.x - table.x) + item.width / 2 < table.width / 2);
        assert.ok(Math.abs(item.z - table.z) + item.depth / 2 < table.depth / 2);
      }
    }
  }
  assert.equal(variants.size, 24);
  assert.ok(counts.size > 1);
  generator.furnish({ ...room, id: "another-kitchen" }, { seed: 999 });
  assert.deepEqual(first, generator.furnish(room, { seed: 2 }));
});

test("compact kitchens omit prep and storage without stranded tabletop props", () => {
  const items = new KitchenRoomGenerator().furnish({ ...room, maxX: 2, maxZ: 2.5 }, { seed: 2 });
  assert.deepEqual(items.map(item => item.object), ["KitchenFireplace", "FireplaceCauldron"]);
});

test("west kitchen entry faces the east-wall hearth with a clear cooking area", () => {
  const openings = [{ roomId: room.id, floorY: room.floorY, kind: "door", side: "WEST",
    axis: "x", coordinate: room.minX, center: 3, width: 1 }];
  for (let seed = 0; seed < 24; seed++) {
    const items = new KitchenRoomGenerator().furnish(room, { seed, openings });
    const hearth = items.find(item => item.object === "KitchenFireplace");
    const cauldron = items.find(item => item.object === "FireplaceCauldron");
    assert.equal(hearth.rotation, -90);
    assert.equal(hearth.width, 0.815);
    assert.equal(hearth.depth, 1.407);
    assert.ok(Math.abs(hearth.z - openings[0].center) < 0.11);
    assert.ok(Math.abs(hearth.x + hearth.width / 2 - (room.maxX + 0.22)) < 0.000001);
    assert.ok(hearth.x + 0.2073 > room.maxX, "chimney back is embedded in the wall");
    assert.ok(cauldron.x < hearth.x);
    assert.equal(cauldron.z, hearth.z);
    const floorProps = items.filter(item => item.y === 0);
    floorProps.forEach((item, index) => {
      for (const other of floorProps.slice(index + 1)) {
        assert.ok(Math.abs(item.x - other.x) >= (item.width + other.width) / 2 ||
          Math.abs(item.z - other.z) >= (item.depth + other.depth) / 2,
        `${item.object}/${other.object} overlap`);
      }
    });
  }
});

test("blocked prep bank removes its food group and openings exclude tall furniture", () => {
  const items = new KitchenRoomGenerator().furnish(room, { seed: 2, openings: [
    { roomId: room.id, floorY: room.floorY, kind: "door", axis: "x", coordinate: 4, center: 1.6, width: 1 },
    { roomId: room.id, floorY: room.floorY, kind: "window", axis: "z", coordinate: 0, center: 0.85, width: 1 },
  ] });
  assert.ok(!items.some(item => ["KitchenTable", "PlateBread", "BowlGreenVegetables", "BowlRedFruit", "KitchenFireplace", "FireplaceCauldron"].includes(item.object)));
});

test("active authored pipeline publishes kitchen objects and replaces old seeded props", async () => {
  const authored = await CastleBasePlanGenerator.generate({ seed: 2 });
  const kitchen = authored.spaces.find(space => space.id === "kitchen");
  const quarters = authored.spaces.find(space => space.id === "service-quarters");
  assert.deepEqual([kitchen.minX, kitchen.minZ, kitchen.maxX, kitchen.maxZ], [0.375, 0.375, 3.625, 3.875]);
  const hearth = authored.furniture.find(item => item.object === "KitchenFireplace");
  const pan = authored.furniture.find(item => item.object === "HangingFryingPan");
  assert.ok(Math.abs(pan.x - pan.width / 2 - kitchen.wallBounds.minX) < 0.000001,
    "pan sits against the actual wall face");
  assert.ok(pan.z - pan.depth / 2 > hearth.z + hearth.depth / 2,
    "pan hangs beside the chimney rather than in front of it");
  assert.equal(hearth.rotation, 0);
  assert.ok(Math.abs(hearth.z - hearth.depth / 2 - (kitchen.wallBounds.minZ - 0.22)) < 0.000001);
  assert.ok(hearth.z - 0.2073 < kitchen.wallBounds.minZ, "chimney back is embedded in the long side wall");
  assert.deepEqual([quarters.minX, quarters.minZ, quarters.maxX, quarters.maxZ], [3.625, 3.875, 7.625, 7.625]);
  assert.ok(authored.furniture.some(item => item.roomId === quarters.id && item.role === "servantBed"));
  assert.ok(authored.furniture.some(item => item.object === "KitchenTable"));
  const options = { position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
    doors: [{ side: "NORTH", offset: 1, width: 2 }], basePlanId: "castle-demo-compact", seed: 2 };
  const castle = { id: "castle-0", object: "Castle", buildPlan: await CastleAuthoredBuildPlan.generate(options) };
  const map = { cols: 32, rows: 32, objects: [castle] };
  KitchenRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.find(item => item.object === "KitchenFireplace").chimneyHeight > 9,
    "basement chimney reaches above the keep roof rather than the terrace");
  KitchenRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
  castle.buildPlan = await CastleAuthoredBuildPlan.generate({ ...options, seed: 4 });
  KitchenRoomMapObjects.prepareMap(map);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
  assert.notDeepEqual(map.objects.slice(1), first);
  assert.ok(map.objects.slice(1).every(item => item.position.y >= 0));
});

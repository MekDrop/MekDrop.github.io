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

test("blocked prep bank removes its food group and openings exclude tall furniture", () => {
  const items = new KitchenRoomGenerator().furnish(room, { seed: 2, openings: [
    { roomId: room.id, floorY: room.floorY, kind: "door", axis: "x", coordinate: 4, center: 1.6, width: 1 },
    { roomId: room.id, floorY: room.floorY, kind: "window", axis: "z", coordinate: 0, center: 0.85, width: 1 },
  ] });
  assert.ok(!items.some(item => ["KitchenTable", "PlateBread", "BowlGreenVegetables", "BowlRedFruit", "KitchenFireplace", "FireplaceCauldron"].includes(item.object)));
});

test("active authored pipeline publishes kitchen objects and replaces old seeded props", async () => {
  const authored = await CastleBasePlanGenerator.generate({ seed: 2 });
  assert.ok(authored.furniture.some(item => item.object === "KitchenTable"));
  const options = { position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
    doors: [{ side: "NORTH", offset: 1, width: 2 }], basePlanId: "castle-demo-compact", seed: 2 };
  const castle = { id: "castle-0", object: "Castle", buildPlan: await CastleAuthoredBuildPlan.generate(options) };
  const map = { cols: 32, rows: 32, objects: [castle] };
  KitchenRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.find(item => item.object === "KitchenFireplace").chimneyHeight > 1.65);
  KitchenRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
  castle.buildPlan = await CastleAuthoredBuildPlan.generate({ ...options, seed: 4 });
  KitchenRoomMapObjects.prepareMap(map);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
  assert.notDeepEqual(map.objects.slice(1), first);
  assert.ok(map.objects.slice(1).every(item => item.position.y >= 0));
});

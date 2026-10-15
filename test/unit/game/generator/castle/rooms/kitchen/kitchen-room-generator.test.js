import test from "node:test";
import assert from "node:assert/strict";
import { KitchenRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/kitchen/KitchenRoomGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { KitchenRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/kitchen/KitchenRoomMapObjects.js";

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
      assert.ok(item.z - item.depth / 2 >= room.minZ - (item.wallInset ?? 0) - 1e-6);
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

test("west kitchen entry keeps the hearth on the preparation wall with its rear clear of masonry", () => {
  const openings = [{ roomId: room.id, floorY: room.floorY, kind: "door", side: "WEST",
    axis: "x", coordinate: room.minX, center: 3, width: 1 }];
  for (let seed = 0; seed < 24; seed++) {
    const items = new KitchenRoomGenerator().furnish(room, { seed, openings });
    const hearth = items.find(item => item.object === "KitchenFireplace");
    const cauldron = items.find(item => item.object === "FireplaceCauldron");
    assert.equal(hearth.rotation, 180);
    assert.equal(hearth.width, 1.47);
    assert.equal(hearth.depth, 0.88);
    assert.ok(Math.abs(hearth.z + 0.42 - (room.maxZ - 0.155)) < 1e-6,
      "the full rear plane is 3 cm clear of the inner wall face");
    assert.ok(cauldron.z < hearth.z);
    assert.equal(cauldron.x, hearth.x);
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
  assert.ok(!items.some(item => ["KitchenTable", "PlateBread", "BowlGreenVegetables", "BowlRedFruit"].includes(item.object)));
  const hearth = items.find(item => item.object === "KitchenFireplace");
  assert.ok(!hearth || hearth.x - hearth.width / 2 >= 1.35, "hearth is beside the window or omitted when its larger measured body cannot fit");
});

test("active authored pipeline publishes kitchen objects and replaces old seeded props", async () => {
  const authored = await CastleBasePlanGenerator.generate({ planId: "castle-demo-compact", seed: 2 });
  const kitchen = authored.spaces.find(space => space.id === "kitchen");
  const quarters = authored.spaces.find(space => space.id === "service-quarters");
  assert.deepEqual([kitchen.minX, kitchen.minZ, kitchen.maxX, kitchen.maxZ], [0.375, 0.375, 3.625, 3.875]);
  const hearth = authored.furniture.find(item => item.object === "KitchenFireplace");
  const pan = authored.furniture.find(item => item.object === "HangingFryingPan");
  const table = authored.furniture.find(item => item.object === "KitchenTable");
  assert.ok(Math.abs(pan.z + pan.depth / 2 - kitchen.wallBounds.maxZ) < 0.000001,
    "pan sits against the actual wall face");
  assert.equal(pan.x, table.x, "utensil row is centred above the preparation table");
  assert.equal(pan.rotation, 180, "utensils face into the kitchen");
  assert.ok(pan.y > 0.564499, "utensils clear the tabletop");
  assert.ok(pan.z - pan.depth / 2 > hearth.z + hearth.depth / 2,
    "pan hangs beside the chimney rather than in front of it");
  assert.equal(hearth.rotation, 0);
  assert.ok(Math.abs(hearth.z - 0.42 - (kitchen.wallBounds.minZ + 0.155)) < 0.000001);
  assert.ok(hearth.z - 0.42 >= kitchen.wallBounds.minZ + 0.125 - 1e-6, "firebox remains clear of the wall");
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


test("side-tower kitchens retain preparation, pantry storage and cooking furnishings in every theme", async () => {
  for (const seed of [4, 5, 10, 11, 16, 17, 22, 23, 28, 29]) {
    const plan = await CastleBasePlanGenerator.generate({ planId: "castle-compact-service-wing", seed });
    const items = plan.furniture.filter(item => item.roomId === "kitchen");
    for (const object of ["KitchenFireplace", "FirewoodStack", "FireplaceCauldron", "KitchenTable", "PlateBread", "BowlGreenVegetables", "BowlRedFruit", "HangingFryingPan", "StoragePotteryJar"]) {
      assert.ok(items.some(item => item.object === object), object + " missing for seed " + seed);
    }
    const shelf = items.find(item => item.role === "storageShelf");
    assert.ok(shelf);
    const decorations = items.filter(item => item.supportId === shelf.id);
    assert.equal(decorations.length, 2);
    for (const item of decorations) {
      assert.equal(item.y, 0.9625);
      assert.ok(Math.abs(item.x - shelf.x) + item.width / 2 <= shelf.width / 2 + 1e-6);
      assert.ok(Math.abs(item.z - shelf.z) + item.depth / 2 <= shelf.depth / 2 + 1e-6);
    }
    assert.ok(items.every(item => !item.placementIssue));
  }
});

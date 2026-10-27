import assert from "node:assert/strict";
import { test } from "node:test";
import { RoomFurnishingChoices } from "../../../../../../src/game/generator/castle/rooms/RoomFurnishingChoices.js";
import { RoyalBedroomRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/royal-bedroom/RoyalBedroomRoomGenerator.js";
import { KitchenRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/kitchen/KitchenRoomGenerator.js";
import { TerraceStorageRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/terrace-storage/TerraceStorageRoomGenerator.js";
import { ThroneRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/throne/ThroneRoomGenerator.js";

const room = {
  id: "royal-chamber",
  purpose: "Royal sleeping room",
  minX: 0.375,
  maxX: 3.625,
  minZ: 3.875,
  maxZ: 7.625,
  floorY: -3,
  level: -1,
  height: 3,
};

test("candidate preferences repeat without mutating inputs or sharing a random stream", () => {
  const values = [0, 0.2, 0.5, 0.8, 1];
  const expected = RoomFurnishingChoices.order(values, room, "bed", 42);
  RoomFurnishingChoices.order(values, room, "decoration", 42);
  assert.deepEqual(RoomFurnishingChoices.order(values, room, "bed", 42), expected);
  assert.deepEqual(values, [0, 0.2, 0.5, 0.8, 1]);
  assert.deepEqual([...expected].sort(), [...values].sort());
});

test("each bedroom concept has several compact arrangements with its essential inventory", () => {
  const generator = new RoyalBedroomRoomGenerator();
  for (let concept = 0; concept < 5; concept++) {
    const layouts = new Set();
    for (let seed = concept * 2; seed < 100; seed += 10) {
      const items = generator.furnish(room, { seed });
      assert.equal(items.filter(item => item.role === "royalBed").length, 1);
      assert.ok(items.some(item => item.role === "wardrobe"));
      assert.ok(items.some(item => item.object === "BedsideDrawers"));
      assert.ok(items.some(item => item.object === "CandleStand"));
      layouts.add(JSON.stringify(items.map(item => [item.object ?? item.role, item.x, item.z, item.rotation])));
      assert.deepEqual(generator.furnish(room, { seed }), items);
    }
    assert.ok(layouts.size >= 4, `concept ${concept} has ${layouts.size} arrangements`);
  }
});

test("kitchen preparation uses all six food orders on the same measured tabletop", () => {
  const generator = new KitchenRoomGenerator();
  const orders = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const items = generator.furnish({
      ...room,
      id: "kitchen",
      maxX: room.minX + 4,
      maxZ: room.minZ + 4,
    }, { seed });
    const table = items.find(item => item.object === "Table");
    const bowls = items.filter(item => item.object === "Bowl");
    assert.equal(bowls.length, 3);
    bowls.sort((a, b) => a.z - b.z);
    orders.add(bowls.map(item => item.items[0].object).join(","));
    for (const bowl of bowls) {
      assert.ok(Math.abs(bowl.x - table.x) + bowl.width / 2 < table.width / 2);
      assert.ok(Math.abs(bowl.z - table.z) + bowl.depth / 2 < table.depth / 2);
      assert.equal(bowl.y, 0.564499);
    }
  }
  assert.equal(orders.size, 6);
});

test("stored tea-service rotations preserve every parent and its tabletop footprint", () => {
  const generator = new TerraceStorageRoomGenerator();
  const rotations = new Set();
  for (let seed = 0; seed < 24; seed++) {
    const items = generator.furnish(room, { seed });
    rotations.add(items.find(item => item.object === "ServingTray").rotation);
    for (const item of items.filter(item => item.supportId)) {
      const support = items.find(parent => parent.id === item.supportId);
      assert.ok(support);
      assert.ok(Math.abs(item.x - support.x) + item.width * item.scale / 2 <= support.width * support.scale / 2 + 1e-6);
      assert.ok(Math.abs(item.z - support.z) + item.depth * item.scale / 2 <= support.depth * support.scale / 2 + 1e-6);
      assert.ok(item.y >= support.y);
    }
    assert.deepEqual(generator.furnish(room, { seed }), items);
  }
  assert.equal(rotations.size, 4);
});

test("large courts vary the complete working side while respecting side entrances", () => {
  const generator = new ThroneRoomGenerator();
  const court = {
    ...room,
    maxX: room.minX + 6,
    maxZ: room.minZ + 7,
  };
  const center = (court.minX + court.maxX) / 2;
  const sides = new Set();
  for (let seed = 0; seed < 12; seed++) {
    const items = generator.furnish(court, { seed });
    const table = items.find(item => item.object === "Table");
    sides.add(Math.sign(table.x - center));
    assert.equal(items.filter(item => item.supportId === table.id).length, 7);
  }
  assert.equal(sides.size, 2);
  for (const side of ["EAST", "WEST"]) {
    const items = generator.furnish(court, {
      seed: 42,
      openings: [{
        roomId: court.id,
        kind: "door",
        side,
        axis: "x",
        coordinate: side === "EAST" ? court.maxX : court.minX,
        center: court.minZ + 3.25,
        width: 1,
      }],
    });
    const table = items.find(item => item.object === "Table");
    assert.equal(Math.sign(table.x - center), side === "EAST" ? -1 : 1);
  }
});

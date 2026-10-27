import assert from "node:assert/strict";
import { test } from "node:test";
import { TerraceStorageRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/terrace-storage/TerraceStorageRoomGenerator.js";
import { StorageRoomBarrels } from "../../../../../../../src/game/generator/castle/rooms/terrace-storage/StorageRoomBarrels.js";
import { RoomPlacementRules } from "../../../../../../../src/game/generator/castle/rooms/RoomPlacementRules.js";

const room = {
  id: "storage",
  purpose: "Storage",
  minX: 0,
  maxX: 3.25,
  minZ: 0,
  maxZ: 3.75,
  floorY: 0,
  level: 0,
  height: 3,
};

test("some storerooms gain barrels at the wall while others retain open space", () => {
  const generator = new TerraceStorageRoomGenerator();
  const counts = new Set();
  for (let seed = 0; seed < 24; seed++) {
    const items = generator.furnish(room, { seed });
    const barrels = items.filter(item => item.object === "Barrel");
    counts.add(barrels.length);
    assert.deepEqual(generator.furnish(room, { seed }), items);
    const placed = items.filter(item => item.object !== "Barrel");
    for (const barrel of barrels) {
      assert.ok(RoomPlacementRules.accepts(barrel, room, placed));
      const gap = Math.min(barrel.x - barrel.width / 2, room.maxX - barrel.x - barrel.width / 2,
        barrel.z - barrel.depth / 2, room.maxZ - barrel.z - barrel.depth / 2);
      assert.ok(gap >= 0.15 && gap < 0.16);
      const dx = Math.max(0, Math.abs(barrel.x - room.maxX / 2) - barrel.width / 2);
      const dz = Math.max(0, Math.abs(barrel.z - room.maxZ / 2) - barrel.depth / 2);
      assert.ok(Math.hypot(dx, dz) >= 0.5, "the central passage stays open");
      placed.push(barrel);
    }
  }
  assert.ok(counts.has(0));
  assert.ok(counts.has(1));
  assert.ok(counts.has(2));
});

test("door swings can consume every wall slot without forcing a barrel into the aisle", () => {
  const openings = [
    {
      axis: "x",
      coordinate: room.minX,
      center: room.maxZ / 2,
    },
    {
      axis: "x",
      coordinate: room.maxX,
      center: room.maxZ / 2,
    },
    {
      axis: "z",
      coordinate: room.minZ,
      center: room.maxX / 2,
    },
    {
      axis: "z",
      coordinate: room.maxZ,
      center: room.maxX / 2,
    },
  ].map(opening => ({
    ...opening,
    kind: "door",
    floorY: 0,
    width: 1.5,
  }));
  for (let seed = 0; seed < 12; seed++) {
    assert.deepEqual(StorageRoomBarrels.furnish(room, [], {
      seed,
      openings,
    }), []);
  }
});

test("a stair shaft cannot count as a shortcut around a barrel in the only aisle", () => {
  const narrow = {
    ...room,
    maxX: 4,
    maxZ: 5,
  };
  const stair = {
    minX: 1.2,
    maxX: 4,
    minZ: 1,
    maxZ: 4,
    from: 0,
    to: 1,
  };
  const barrels = StorageRoomBarrels.furnish(narrow, [], {
    seed: 4,
    stairs: [stair],
  });
  for (const barrel of barrels) {
    if (barrel.z + barrel.depth / 2 > stair.minZ && barrel.z - barrel.depth / 2 < stair.maxZ) {
      assert.ok(stair.minX - barrel.x - barrel.width / 2 >= 0.6);
    }
  }
});

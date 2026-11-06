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

test("storerooms add wall-side supplies while retaining open space", () => {
  const generator = new TerraceStorageRoomGenerator();
  const counts = new Set();
  const types = new Set();
  const scales = new Set();
  const rotations = new Set();
  const layouts = new Set();
  for (let seed = 0; seed < 24; seed++) {
    const items = generator.furnish(room, { seed });
    const barrels = items.filter(item => item.id?.includes("-spare-barrel-"));
    for (const item of barrels) {
      types.add(item.object);
      scales.add(item.scale);
      rotations.add(item.rotation);
    }
    layouts.add(JSON.stringify(barrels));
    counts.add(barrels.length);
    assert.deepEqual(generator.furnish(room, { seed }), items);
    const placed = items.filter(item => !item.id?.includes("-spare-barrel-"));
    for (const barrel of barrels) {
      assert.ok(RoomPlacementRules.accepts(barrel, room, placed));
      const gap = Math.min(barrel.x - barrel.width * barrel.scale / 2, room.maxX - barrel.x - barrel.width * barrel.scale / 2,
        barrel.z - barrel.depth * barrel.scale / 2, room.maxZ - barrel.z - barrel.depth * barrel.scale / 2);
      assert.ok(Math.abs(gap - 0.15) < 1e-6);
      const dx = Math.max(0, Math.abs(barrel.x - room.maxX / 2) - barrel.width * barrel.scale / 2);
      const dz = Math.max(0, Math.abs(barrel.z - room.maxZ / 2) - barrel.depth * barrel.scale / 2);
      assert.ok(Math.hypot(dx, dz) >= 0.5, "the central passage stays open");
      placed.push(barrel);
    }
  }
  assert.ok([...counts].every(count => count >= 3));
  assert.deepEqual([...types].sort(), ["Barrel", "Crate", "PotteryJar"]);
  assert.ok(scales.size >= 3);
  assert.equal(rotations.size, 4);
  assert.ok(layouts.size >= 20);
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
    width: 2,
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
    if (barrel.z + barrel.depth * barrel.scale / 2 > stair.minZ && barrel.z - barrel.depth * barrel.scale / 2 < stair.maxZ) {
      assert.ok(stair.minX - barrel.x - barrel.width * barrel.scale / 2 >= 0.6);
    }
  }
});

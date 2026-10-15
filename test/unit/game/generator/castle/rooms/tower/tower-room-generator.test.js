import assert from "node:assert/strict";
import { it } from "node:test";
import { TowerRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/tower/TowerRoomGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";

it("keeps a continuous watch aisle and reproduces independently seeded storeys", () => {
  const generator = new TowerRoomGenerator(1);
  const room = {
    id: "watch",
    level: 0,
    floorY: 3,
    minX: 0,
    maxX: 3.5,
    minZ: 0,
    maxZ: 3.5,
  };
  const variants = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const items = generator.furnish(room, { seed });
    assert.deepEqual(items, generator.furnish(room, { seed }));
    assert.ok(items.length >= 2 && items.length <= 5);
    variants.add(JSON.stringify(items));
    for (const item of items) {
      assert.ok(item.x - item.width / 2 >= 0.205 && item.x + item.width / 2 <= 3.295);
      assert.ok(item.z - item.depth / 2 >= 0.205 && item.z + item.depth / 2 <= 3.295);
      assert.ok(Math.abs(item.x - 1.75) >= item.width / 2 + 0.45);
      assert.ok(Math.abs(item.z - 1.75) >= item.depth / 2 + 0.45);
      for (const other of items) {
        if (other === item) { continue; }
        assert.ok(Math.abs(item.x - other.x) >= (item.width + other.width) / 2 + 0.22 ||
          Math.abs(item.z - other.z) >= (item.depth + other.depth) / 2 + 0.22);
      }
    }
  }
  assert.equal(variants.size, 40);
  assert.notDeepEqual(generator.furnish(room), generator.furnish({
    ...room,
    level: 1,
    floorY: 7,
  }));
});

it("omits furniture from cramped rooms and occupied stair shafts", () => {
  const generator = new TowerRoomGenerator(1);
  const room = {
    id: "watch",
    level: 0,
    floorY: 0,
    minX: 0,
    maxX: 1.75,
    minZ: 0,
    maxZ: 1.75,
  };
  assert.deepEqual(generator.furnish(room), []);
  assert.deepEqual(generator.furnish({
    ...room,
    maxX: 3.5,
    maxZ: 3.5,
  }, {
    stairs: [{
      from: 0,
      to: 1,
      minX: 0,
      maxX: 3.5,
      minZ: 0,
      maxZ: 3.5,
    }],
  }), []);
});

it("furnishes both authored tower storeys while preserving shooting and door access", async () => {
  for (const seed of [2, 4]) {
    const plan = await CastleBasePlanGenerator.generate({
      planId: "castle-01",
      seed,
    });
    const items = plan.furniture.filter((item) => item.role === "towerProp");
    assert.ok(items.some((item) => item.floorY === 0));
    assert.ok(items.some((item) => item.floorY === 4));
    assert.ok(items.every((item) => !item.roomId.startsWith("corner-3") && !item.roomId.startsWith("corner-4")));
    for (const item of items) {
      for (const opening of plan.openings.filter((opening) => opening.roomId === item.roomId)) {
        const perpendicular = opening.axis === "x" ? item.x : item.z;
        const along = opening.axis === "x" ? item.z : item.x;
        const halfPerpendicular = (opening.axis === "x" ? item.width : item.depth) / 2;
        const halfAlong = (opening.axis === "x" ? item.depth : item.width) / 2;
        assert.ok(Math.abs(perpendicular - opening.coordinate) >= halfPerpendicular + 0.85 ||
          Math.abs(along - opening.center) >= halfAlong + opening.width / 2 + 0.3);
      }
    }
  }
});

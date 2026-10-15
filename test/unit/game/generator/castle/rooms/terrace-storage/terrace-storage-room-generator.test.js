import assert from "node:assert/strict";
import { test } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { KitchenRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/kitchen/KitchenRoomMapObjects.js";

test("terrace spares stay in storage with supported tea ware and a central aisle in both mirrors", async () => {
  for (const seed of [2, 3]) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const room = plan.spaces.find(space => space.id === "storage-south");
    const items = plan.furniture.filter(item => item.roomId === room.id);
    assert.deepEqual(items.map(item => item.object), ["TerraceSunbed", "TeaTable", "TerraceTeaChair",
      "TerraceServingTray", "TerraceTeapot", "TerraceTeacup", "TerraceReadingBook"]);
    for (const item of items) {
      assert.ok(item.x - item.width * item.scale / 2 >= room.minX);
      assert.ok(item.x + item.width * item.scale / 2 <= room.maxX);
      assert.ok(item.z - item.depth * item.scale / 2 >= room.minZ);
      assert.ok(item.z + item.depth * item.scale / 2 <= room.maxZ);
      if (item.supportId) {
        const support = items.find(candidate => candidate.id === item.supportId);
        assert.ok(support);
        assert.ok(Math.abs(item.x - support.x) + item.width * item.scale / 2 <= support.width * support.scale / 2);
        assert.ok(Math.abs(item.z - support.z) + item.depth * item.scale / 2 <= support.depth * support.scale / 2);
        assert.ok(item.y >= support.y);
      }
    }
    const centerX = (room.minX + room.maxX) / 2, centerZ = (room.minZ + room.maxZ) / 2;
    for (const item of items.filter(item => !item.supportId)) {
      assert.ok(Math.hypot(Math.max(0, Math.abs(item.x - centerX) - item.width * item.scale / 2),
        Math.max(0, Math.abs(item.z - centerZ) - item.depth * item.scale / 2)) >= 0.45);
    }
  }
});

test("storage equipment publishes through map objects without duplication", async () => {
  const buildPlan = await CastleAuthoredBuildPlan.generate({ basePlanId: "castle-demo-compact", seed: 2,
    position: { x: 0, z: 0, width: 8, depth: 8, elevation: 2 }, doors: [{ side: "NORTH", offset: 4, width: 2 }] });
  const map = { cols: 60, rows: 60, objects: [{ id: "storage-castle", object: "Castle", buildPlan }] };
  KitchenRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects);
  KitchenRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, first);
  for (const object of ["TerraceSunbed", "TeaTable", "TerraceTeaChair", "TerraceServingTray",
    "TerraceTeapot", "TerraceTeacup", "TerraceReadingBook"]) {
    assert.equal(map.objects.filter(item => item.object === object).length, 1);
  }
});

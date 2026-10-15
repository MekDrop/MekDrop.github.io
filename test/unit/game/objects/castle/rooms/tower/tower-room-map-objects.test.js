import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { TowerRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/tower/TowerRoomMapObjects.js";

it("publishes floor-correct tower objects once and replaces stale seed placements", async () => {
  const options = {
    basePlanId: "castle-01",
    seed: 2,
    position: {
      x: 0,
      z: 0,
      width: 52,
      depth: 32,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 25,
      width: 2,
    }],
  };
  const castle = {
    id: "castle-qa",
    object: "Castle",
    buildPlan: await CastleAuthoredBuildPlan.generate(options),
  };
  const map = {
    cols: 100,
    rows: 100,
    objects: [castle],
  };
  TowerRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.length > 0);
  assert.ok(first.every((item) => item.position.y === 3 || item.position.y === 7));
  assert.ok(first.every((item) => item.sourceCastleId === castle.id && item.scale === 1));
  TowerRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
  castle.buildPlan = await CastleAuthoredBuildPlan.generate({
    ...options,
    seed: 3,
  });
  TowerRoomMapObjects.prepareMap(map);
  const expected = castle.buildPlan.metadata.runtime.residential.furniture.filter((item) => item.role === "towerProp");
  assert.equal(map.objects.length, expected.length + 1);
  assert.equal(new Set(map.objects.map((item) => item.id)).size, map.objects.length);
  assert.notDeepEqual(map.objects.slice(1), first);
  for (const item of map.objects.filter((item) => item.object === "Chair")) {
    const placement = expected.find((entry) => item.id.includes(`${entry.roomId}-`) && entry.object === item.object);
    const room = castle.buildPlan.metadata.runtime.residential.placedRooms.find((room) => room.id === placement.roomId);
    assert.equal(item.rotation, placement.z < (room.minZ + room.maxZ) / 2 ? 90 : 270);
  }
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { LeisureRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/leisure/LeisureRoomGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { LeisureRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/leisure/LeisureRoomMapObjects.js";

const room = {
  id: "leisure",
  minX: 0,
  maxX: 3,
  minZ: 0,
  maxZ: 4,
  floorY: 3,
  level: 1,
};

it("restores the two terrace planters away from the entrance without seeded variation", () => {
  const generator = new LeisureRoomGenerator();
  const items = generator.furnish(room);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(({ x, z }) => ({
    x,
    z,
  })), [{
    x: 0.6,
    z: 3.4,
  }, {
    x: 2.4,
    z: 3.4,
  }]);
  assert.ok(items.every((item) => item.object === "Planter"));
  assert.deepEqual(generator.furnish(room, { seed: 20 }), generator.furnish(room, { seed: 22 }));
  assert.deepEqual(generator.furnish({
    ...room,
    maxX: 1.9,
  }), []);
  assert.deepEqual(generator.furnish({
    ...room,
    kind: "courtyard",
    level: 0,
  }), []);
  assert.deepEqual(generator.furnish(room, {
    openings: [{
      kind: "door",
      axis: "z",
      coordinate: 4,
      center: 1.5,
      width: 3,
      floorY: 3,
    }],
  }), []);
  assert.deepEqual(generator.furnish(room, {
    stairs: [{
      minX: 0,
      maxX: 3,
      minZ: 3,
      maxZ: 4,
    }],
  }), []);
});
it("uses only plants in both active authored terraces", async () => {
  for (const seed of [20, 21, 22, 23]) {
    const plan = await CastleBasePlanGenerator.generate({
      planId: "castle-demo-compact",
      seed,
    });
    for (const id of ["terrace-west", "terrace-south"]) {
      const items = plan.furniture.filter((item) => item.roomId === id);
      assert.ok(items.length > 0);
      assert.ok(items.every((item) => item.object === "Planter"));
    }
  }
});

it("publishes plants idempotently and removes obsolete leisure furniture", async () => {
  const buildPlan = await CastleAuthoredBuildPlan.generate({
    basePlanId: "castle-demo-compact",
    position: {
      x: -4,
      z: -4,
      width: 8,
      depth: 8,
      elevation: 0,
    },
    doors: [{
      side: "NORTH",
      offset: 3,
      width: 2,
    }],
    seed: 20,
  });
  const map = {
    cols: 20,
    rows: 20,
    objects: [{
      id: "castle-test",
      object: "Castle",
      buildPlan,
    }],
  };
  const residential = buildPlan.metadata.runtime.residential;
  residential.furniture.push({
    role: "leisureTable",
    object: "Table",
    width: 1.25,
    height: 1.0622,
    depth: 1.25,
    roomId: "terrace-west",
    x: 0,
    z: 0,
    scale: 1,
    floorY: 3,
  });
  map.objects.push({
    id: "castle-test-leisure-old-0",
    object: "Table",
    width: 1.25,
    height: 1.0622,
    depth: 1.25,
    sourceCastleId: "castle-test",
  });
  LeisureRoomMapObjects.prepareMap(map);
  assert.ok(map.objects.length > 1);
  assert.ok(map.objects.slice(1).every((item) => item.object === "Planter"));
  const once = structuredClone(map.objects);
  LeisureRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, once);
  residential.furniture = residential.furniture.filter((item) => !item.role.startsWith("leisure"));
  LeisureRoomMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 1);
});

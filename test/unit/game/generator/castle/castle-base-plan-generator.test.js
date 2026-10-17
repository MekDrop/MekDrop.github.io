import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleBasePlanInvalidError } from "../../../../../src/game/errors/castle/index.js";
import { ServiceRoomGenerator } from "../../../../../src/game/generator/castle/rooms/service/ServiceRoomGenerator.js";

it("compiles all authored plans with fixed rooms, stairs, roofs, doors and windows", async () => {
  assert.deepEqual((await CastleBasePlanGenerator.plans).map((plan) => plan.id), CastleBasePlanGenerator.layoutPlanIds);
  for (const authored of (await CastleBasePlanGenerator.plans)) {
    const result = await CastleBasePlanGenerator.generate({
      planId: authored.id,
      unitMetres: 0.5,
      baseY: 3,
    });
    assert.equal(result.spaces.length, authored.levels.reduce((sum, floor) => sum + floor.spaces.length, 0));
    assert.equal(result.openings.length, authored.levels.reduce((sum, floor) =>
      sum + floor.spaces.reduce((count, space) => count + space.openings.length, 0), 0));
    assert.ok(result.openings.some((opening) => opening.kind === "window"));
    assert.ok(result.openings.some((opening) => opening.kind === "door"));
    assert.equal(result.stairs.length, authored.staircases.length);
    assert.equal(result.roofs.length, authored.roofs.length);
    for (const floor of authored.levels) {
      for (const slot of floor.spaces) {
        const room = result.spaces.find((space) => space.id === slot.id && space.level === floor.index);
        assert.equal(room.minX, slot.bounds[0] * 0.5);
        assert.equal(room.maxZ, (slot.bounds[1] + slot.bounds[3]) * 0.5);
        assert.equal(room.floorY, floor.elevation + 3);
        for (const other of floor.spaces) {
          if (slot === other) {
            continue;
          }
          assert.ok(slot.bounds[0] + slot.bounds[2] <= other.bounds[0] ||
            other.bounds[0] + other.bounds[2] <= slot.bounds[0] ||
            slot.bounds[1] + slot.bounds[3] <= other.bounds[1] ||
            other.bounds[1] + other.bounds[3] <= slot.bounds[1], `${authored.id} floor ${floor.index}: ${slot.id}/${other.id}`);
        }
      }
    }
    assert.equal(result.entrance.kind, "door");
    assert.equal(result.entrance.floorY, 3);
  }
});

it("selects only enabled layouts and callers cannot mutate the catalogue", async () => {
  const first = await CastleBasePlanGenerator.generate({ seed: "reference" });
  assert.equal(first.basePlanId, CastleBasePlanGenerator.selectPlanId("reference"));
  for (const seed of [1, 42, "murpaxlt_1ungww5"]) {
    assert.equal((await CastleBasePlanGenerator.generate({ seed })).basePlanId, CastleBasePlanGenerator.selectPlanId(seed));
  }
  assert.deepEqual(await CastleBasePlanGenerator.generate({ seed: "reference" }), first);
  const plans = (await CastleBasePlanGenerator.plans);
  plans[0].levels[0].spaces[0].bounds[0] = -100;
  assert.notEqual((await CastleBasePlanGenerator.plans)[0].levels[0].spaces[0].bounds[0], -100);
});

it("mirrors odd seeds around the unchanged entrance, including every structural footprint", async () => {
  const original = await CastleBasePlanGenerator.generate({
    planId: "castle-demo-compact",
    seed: 42,
  });
  const mirrored = await CastleBasePlanGenerator.generate({
    planId: "castle-demo-compact",
    seed: 43,
  });
  assert.deepEqual(CastleBasePlanGenerator.layoutPlanIds, ["castle-demo-compact", "castle-compact-service-wing", "castle-rear-bell-tower"]);
  assert.equal(original.basePlanId, mirrored.basePlanId);
  assert.equal(original.mirrored, false);
  assert.equal(mirrored.mirrored, true);
  assert.equal(original.entrance.side, mirrored.entrance.side);
  assert.equal(original.entrance.center, mirrored.entrance.center);
  assert.equal(original.entrance.coordinate, mirrored.entrance.coordinate);
  const center = original.entrance.center * 2;
  for (const key of ["spaces", "stairs", "roofs", "buildings"]) {
    original[key].forEach((bounds, index) => {
      assert.equal(mirrored[key][index].minX, center - bounds.maxX);
      assert.equal(mirrored[key][index].maxX, center - bounds.minX);
      assert.equal(mirrored[key][index].minZ, bounds.minZ);
      assert.equal(mirrored[key][index].maxZ, bounds.maxZ);
    });
  }
  original.openings.forEach((opening, index) => {
    const mirror = mirrored.openings[index];
    assert.equal(mirror.axis, opening.axis);
    if (opening.axis === "z") {
      assert.equal(mirror.center, center - opening.center);
      assert.equal(mirror.coordinate, opening.coordinate);
    } else {
      assert.equal(mirror.coordinate, center - opening.coordinate);
      assert.equal(mirror.side, opening.side === "WEST" ? "EAST" : "WEST");
    }
  });
  original.furniture.forEach((item, index) => {
    assert.equal(mirrored.furniture[index].x, center - item.x);
    assert.equal(mirrored.furniture[index].z, item.z);
  });
  assert.deepEqual(await CastleBasePlanGenerator.generate({
    planId: "castle-demo-compact",
    seed: "43",
  }), mirrored);
});

it("excludes the retired tower from numeric and named seed selection", () => {
  for (const seed of [...Array(120).keys(), "reference", "tower", "castle"]) {
    assert.notEqual(CastleBasePlanGenerator.selectPlanId(seed), "castle-compact-tower");
  }
  for (const seed of [0, 6, 12]) {
    assert.equal(CastleBasePlanGenerator.selectPlanId(seed), "castle-demo-compact");
    assert.equal(CastleBasePlanGenerator.selectPlanId(seed + 1), "castle-demo-compact");
    assert.equal(CastleBasePlanGenerator.selectPlanId(seed + 2), "castle-compact-service-wing");
    assert.equal(CastleBasePlanGenerator.selectPlanId(seed + 3), "castle-compact-service-wing");
    assert.equal(CastleBasePlanGenerator.selectPlanId(seed + 4), "castle-rear-bell-tower");
    assert.equal(CastleBasePlanGenerator.selectPlanId(seed + 5), "castle-rear-bell-tower");
  }
});

it("runs a room generator at every assigned slot without changing its bounds", async () => {
  const generator = new ServiceRoomGenerator();
  const calls = [];
  generator.furnish = (room) => {
    calls.push({ ...room });

    return [];
  };
  const result = await CastleBasePlanGenerator.generate({
    planId: "castle-demo-compact",
    generators: [generator,
      ...["LibraryRoomGenerator", "ThroneRoomGenerator", "LeisureRoomGenerator", "VestibuleRoomGenerator", "StairwellRoomGenerator", "KitchenRoomGenerator", "RoyalBedroomRoomGenerator", "TerraceStorageRoomGenerator"].map((name) => ({
        constructor: { name },
        furnish: () => [],
      }))],
  });
  const slots = result.spaces.filter((space) => space.generator === "ServiceRoomGenerator");
  assert.deepEqual(calls, slots);
  assert.ok(calls.length > 0);
});

it("rejects unknown plans, invalid scaling, missing generators and malformed apertures", async () => {
  for (const options of [{ planId: "unknown" }, { unitMetres: 0 }, { baseY: NaN }, { generators: [] }]) {
    await assert.rejects(() => CastleBasePlanGenerator.generate(options), CastleBasePlanInvalidError);
  }
  const plan = (await CastleBasePlanGenerator.plans)[0];
  plan.levels[0].spaces[0].openings[0].offset = 100;
  assert.throws(() => CastleBasePlanGenerator.validate(plan), CastleBasePlanInvalidError);
});




it("places the kitchen at the basement stair door, terrace storage on its right and the bedroom in the remaining area", async () => {
  const plan = await CastleBasePlanGenerator.generate({ seed: 2 });
  assert.equal(plan.basePlanId, "castle-compact-service-wing");
  assert.equal(CastleBasePlanGenerator.selectPlanId(3), plan.basePlanId);
  const quarters = plan.spaces.find((room) => room.id === "service-quarters");
  assert.equal(quarters.level, 0);
  assert.equal(quarters.generator, "ServiceRoomGenerator");
  assert.ok(plan.furniture.some((item) => item.roomId === quarters.id));
  for (const id of ["kitchen", "royal-chamber", "basement-storeroom"]) {
    assert.equal(plan.spaces.find((room) => room.id === id).level, -1);
  }
  assert.ok(plan.spaces.some((room) => room.id === "watchtower" && room.level === 2));
  assert.ok(!plan.spaces.some((room) => room.generator === "LibraryRoomGenerator"));
  assert.equal(plan.spaces.find((room) => room.id === "royal-chamber").generator, "RoyalBedroomRoomGenerator");
  assert.ok(plan.spaces.some((room) => room.generator === "ThroneRoomGenerator"));
  assert.ok(plan.spaces.some((room) => room.kind === "terrace"));
  assert.ok(plan.furniture.some((item) => item.roomId === "royal-chamber" && item.role === "royalBed"));
  assert.ok(plan.furniture.some((item) => item.roomId === "kitchen" && item.object === "Fireplace"));
  const kitchen = plan.spaces.find((room) => room.id === "kitchen");
  const storage = plan.spaces.find((room) => room.id === "basement-storeroom");
  const bedroom = plan.spaces.find((room) => room.id === "royal-chamber");
  const entry = plan.openings.find((door) => door.roomId === "basement-stair-room" && door.kind === "door");
  assert.equal(entry.side, "WEST");
  assert.ok(entry.center - entry.width / 2 >= kitchen.minZ && entry.center + entry.width / 2 <= kitchen.maxZ);
  assert.equal(entry.coordinate - kitchen.maxX, 0.25);
  assert.equal(storage.maxZ, kitchen.minZ, "storage is north/right when entering westward from the tower stairs");
  assert.equal(bedroom.maxX, kitchen.minX);
  assert.equal(bedroom.maxX, storage.minX);
  assert.equal(bedroom.minZ, storage.minZ);
  assert.equal(bedroom.maxZ, kitchen.maxZ);
  for (const object of ["Sunbed", "Table", "Chair"]) {
    assert.ok(plan.furniture.some(item => item.roomId === storage.id && item.object === object));
  }
});

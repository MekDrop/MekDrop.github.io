import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleBasePlanInvalidError } from "../../../../../src/game/errors/castle/index.js";
import { ServiceRoomGenerator } from "../../../../../src/game/generator/castle/rooms/ServiceRoomGenerator.js";

it("compiles all authored plans with fixed rooms, stairs, roofs, doors and windows", async () => {
  assert.deepEqual((await CastleBasePlanGenerator.plans).map((plan) => plan.id), ["castle-01", "castle-03", "castle-04", "castle-demo-compact", "castle-compact-tower", "castle-compact-service-wing"]);
  for (const authored of (await CastleBasePlanGenerator.plans)) {
    const result = await CastleBasePlanGenerator.generate({ planId: authored.id, unitMetres: 0.5, baseY: 3 });
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
          if (slot === other) { continue; }
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
  const original = await CastleBasePlanGenerator.generate({ planId: "castle-demo-compact", seed: 42 });
  const mirrored = await CastleBasePlanGenerator.generate({ planId: "castle-demo-compact", seed: 43 });
  assert.deepEqual(CastleBasePlanGenerator.layoutPlanIds, ["castle-demo-compact", "castle-compact-tower", "castle-compact-service-wing"]);
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
  assert.deepEqual(await CastleBasePlanGenerator.generate({ planId: "castle-demo-compact", seed: "43" }), mirrored);
  assert.deepEqual(await CastleBasePlanGenerator.generate({ seed: 43 }), mirrored);
});

it("runs a room generator at every assigned slot without changing its bounds", async () => {
  const generator = new ServiceRoomGenerator();
  const calls = [];
  generator.furnish = (room) => { calls.push({ ...room }); return []; };
  const result = await CastleBasePlanGenerator.generate({ planId: "castle-03", generators: [generator,
    ...["LibraryRoomGenerator", "ThroneRoomGenerator", "LeisureRoomGenerator"].map((name) => ({
      constructor: { name }, furnish: () => [],
    }))] });
  const slots = result.spaces.filter((space) => space.generator === "ServiceRoomGenerator");
  assert.deepEqual(calls, slots);
  assert.ok(calls.length > 1);
});

it("rejects unknown plans, invalid scaling, missing generators and malformed apertures", async () => {
  for (const options of [{ planId: "unknown" }, { unitMetres: 0 }, { baseY: NaN }, { generators: [] }]) {
    await assert.rejects(() => CastleBasePlanGenerator.generate(options), CastleBasePlanInvalidError);
  }
  const plan = (await CastleBasePlanGenerator.plans)[0];
  plan.levels[0].spaces[0].openings[0].offset = 100;
  assert.throws(() => CastleBasePlanGenerator.validate(plan), CastleBasePlanInvalidError);
});

it("keeps the symmetric throne hall double height and its upper level empty", async () => {
  const plan = await CastleBasePlanGenerator.generate({ planId: "castle-01" });
  const throne = plan.placedRooms.find((room) => room.id === "throne-hall");
  assert.equal(throne.floorSpan, 2);
  assert.equal(throne.height, 7.75);
  assert.ok(!plan.furniture.some((item) => item.roomId === "throne-void"));
});

it("selects the tower variant with rearranged rooms and a connected lookout floor", async () => {
  const compact = await CastleBasePlanGenerator.generate({ seed: 0 });
  const tower = await CastleBasePlanGenerator.generate({ seed: 2 });
  assert.equal(tower.basePlanId, "castle-compact-tower");
  assert.equal(CastleBasePlanGenerator.selectPlanId(3), tower.basePlanId);
  assert.ok(tower.stairs.some((stair) => stair.to === 2));
  assert.ok(tower.spaces.some((room) => room.id === "watchtower" && room.level === 2 && room.generator === "TowerRoomGenerator"));
  assert.ok(tower.roofs.some((roof) => roof.id === "watchtower-roof" && roof.y === 9));
  for (const id of ["kitchen", "service-quarters"]) {
    const original = compact.spaces.find((room) => room.id === id);
    const variant = tower.spaces.find((room) => room.id === id);
    assert.notEqual(variant.minX, original.minX);
    assert.notEqual(variant.minZ, original.minZ);
  }
});

it("keeps the service-wing alternative separate and moves quarters to the entrance floor", async () => {
  const plan = await CastleBasePlanGenerator.generate({ seed: 4 });
  assert.equal(plan.basePlanId, "castle-compact-service-wing");
  assert.equal(CastleBasePlanGenerator.selectPlanId(5), plan.basePlanId);
  const quarters = plan.spaces.find((room) => room.id === "service-quarters");
  assert.equal(quarters.level, 0);
  assert.equal(quarters.generator, "ServiceRoomGenerator");
  assert.ok(plan.furniture.some((item) => item.roomId === quarters.id));
  for (const id of ["basement-storeroom", "basement-passage"]) {
    assert.equal(plan.spaces.find((room) => room.id === id).level, -1);
  }
  const tower = await CastleBasePlanGenerator.generate({ planId: "castle-compact-tower" });
  assert.equal(tower.spaces.find((room) => room.id === "service-quarters").level, -1);
  assert.ok(plan.spaces.some((room) => room.id === "watchtower" && room.level === 2));
  assert.ok(!plan.spaces.some((room) => ["KitchenRoomGenerator", "LibraryRoomGenerator"].includes(room.generator)));
  assert.ok(plan.spaces.some((room) => room.generator === "ThroneRoomGenerator"));
  assert.ok(plan.spaces.some((room) => room.kind === "terrace"));
  assert.ok(plan.furniture.some((item) => item.roomId === "basement-storeroom"));
});

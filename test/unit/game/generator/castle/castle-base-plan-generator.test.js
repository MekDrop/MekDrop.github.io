import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleBasePlanInvalidError } from "../../../../../src/game/errors/castle/index.js";
import { ServiceRoomGenerator } from "../../../../../src/game/generator/castle/rooms/ServiceRoomGenerator.js";

it("transcribes all four sheets with fixed rooms, stairs, roofs, doors and windows", async () => {
  assert.deepEqual((await CastleBasePlanGenerator.plans).map((plan) => plan.id), ["castle-01", "castle-03", "castle-04", "castle-demo-compact"]);
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

it("pins the compact demo for every seed and callers cannot mutate the catalogue", async () => {
  const first = await CastleBasePlanGenerator.generate({ seed: "reference" });
  assert.equal(first.basePlanId, "castle-demo-compact");
  for (const seed of [1, 42, "murpaxlt_1ungww5"]) {
    assert.equal((await CastleBasePlanGenerator.generate({ seed })).basePlanId, first.basePlanId);
  }
  assert.deepEqual(await CastleBasePlanGenerator.generate({ seed: "reference" }), first);
  const plans = (await CastleBasePlanGenerator.plans);
  plans[0].levels[0].spaces[0].bounds[0] = -100;
  assert.notEqual((await CastleBasePlanGenerator.plans)[0].levels[0].spaces[0].bounds[0], -100);
});

it("runs a room generator at every assigned slot without changing its bounds", async () => {
  const generator = new ServiceRoomGenerator();
  const calls = [];
  generator.furnish = (room) => { calls.push({ ...room }); return []; };
  const result = await CastleBasePlanGenerator.generate({ planId: "castle-03", generators: [generator,
    ...["LibraryRoomGenerator", "ThroneRoomGenerator"].map((name) => ({
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

import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { ThroneRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/throne/ThroneRoomGenerator.js";
import { ThroneRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/throne/ThroneRoomMapObjects.js";

it("mounts court emblems above rear windows through the final map transform", async () => {
  for (const seed of [0, 1, 4, 5, 10]) {
    for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
      const castle = {
        id: "wall-decor-test",
        object: "Castle",
        seed,
        position: {
          x: -14,
          z: -8,
          width: 28,
          depth: 28,
          elevation: 2,
        },
        doors: [{
          side,
          offset: 13,
          width: 2,
        }],
      };
      castle.buildPlan = await CastleAuthoredBuildPlan.generate(castle);
      const residential = castle.buildPlan.metadata.runtime.residential;
      const emblem = residential.furniture.find(item => ["RoyalCrest", "WarCouncilShield"].includes(item.object));
      const room = residential.spaces.find(item => item.id === emblem.roomId);
      assert.equal(emblem.wallAttachment, true, `${seed}/${side}: attached to masonry`);
      assert.equal(emblem.placementIssue, undefined);
      assert.equal(emblem.rotation, 0, "same wall direction as the flanking banners");
      assert.ok(emblem.x - emblem.width * emblem.scale / 2 >= room.minX);
      assert.ok(emblem.x + emblem.width * emblem.scale / 2 <= room.maxX);
      assert.ok(emblem.elevation >= 2.1, "above the window lintel and royal actor");
      const map = {
        cols: 42,
        rows: 42,
        objects: [castle],
      };
      ThroneRoomMapObjects.prepareMap(map);
      const definition = map.objects.find(item => item.object === emblem.object);
      const back = emblem.object === "RoyalCrest" ? -0.04 : -0.05;
      const yaw = definition.rotation * Math.PI / 180;
      const rear = {
        x: definition.position.x + Math.sin(yaw) * back * emblem.scale,
        z: definition.position.z + Math.cos(yaw) * back * emblem.scale,
      };
      const originYaw = residential.origin.yaw * Math.PI / 180;
      const localZ = Math.sin(originYaw) * (rear.x - residential.origin.x) +
        Math.cos(originYaw) * (rear.z - residential.origin.z);
      const banner = residential.furniture.find(item => item.role === "courtProp" && item.object === "Banner");
      assert.ok(Math.abs(localZ - (banner.z + 0.005)) < 1e-6, "rear touches the same wall as the banners");
    }
  }
});

it("reproduces court groups, varies seeds and keeps the central audience lane clear", async () => {
  const arrangements = new Set();
  const counts = new Set();
  const variants = new Set();
  for (const seed of [0, 2, 10, 14, 42, 44, 46, 48, "court-a", "court-b"]) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const items = plan.furniture.filter(item => item.role === "courtProp");
    const repeated = await CastleBasePlanGenerator.generate({ seed });
    assert.deepEqual(items, repeated.furniture.filter(item => item.role === "courtProp"));
    const room = plan.spaces.find(space => space.id === "throne-hall");
    const center = (room.minX + room.maxX) / 2;
    assert.equal(items.filter(item => item.object === "CandleStand").length, 2);
    const work = items.filter(item => ["Lectern", "WritingDesk", "Table"].includes(item.object));
    assert.equal(work.length, 1);
    variants.add(work[0].object);
    assert.equal(items.filter(item => item.object === "ThroneDais").length, 1);
    for (const item of items) {
      if (!["ThroneDais", "RoyalCrest", "WarCouncilShield"].includes(item.object)) {
        assert.ok(Math.abs(item.x - center) - item.width / 2 >= 0.65, `${item.object} leaves the runner clear`);
      }
      assert.ok(item.x - item.width / 2 >= room.minX + 0.1);
      assert.ok(item.x + item.width / 2 <= room.maxX - 0.1);
      assert.ok(item.z - item.depth / 2 >= room.minZ + 0.1);
      assert.ok(item.z + item.depth / 2 <= room.maxZ - 0.1);
    }
    const table = items.find(item => item.object === "WritingDesk");
    for (const detail of items.filter(item => ["DeskGlobe", "Book"].includes(item.object))) {
      assert.ok(Math.abs(detail.elevation - table.elevation - 0.65) < 0.00001);
      assert.ok(Math.abs(detail.x - table.x) + detail.width / 2 <= table.width / 2);
      assert.ok(Math.abs(detail.z - table.z) + detail.depth / 2 <= table.depth / 2);
    }
    arrangements.add(JSON.stringify(items));
    counts.add(items.length);
  }
  assert.ok(arrangements.size >= 5);
  assert.equal(variants.size, 3);
  assert.ok(counts.size >= 2, "optional globe varies the group count");
});

it("omits optional groups in small rooms and offers a working seat in larger halls", () => {
  const generator = new ThroneRoomGenerator();
  const room = {
    id: "throne-hall",
    minX: 0,
    minZ: 0,
    maxX: 3,
    maxZ: 3.25,
  };
  assert.deepEqual(generator.furnish(room), []);
  const small = generator.furnish({
    ...room,
    maxX: 3.5,
  });
  assert.equal(small.filter(item => item.object === "CandleStand").length, 2);
  assert.ok(!small.some(item => ["Lectern", "WritingDesk", "Table"].includes(item.object)));
  const large = generator.furnish({
    ...room,
    maxX: 5,
    maxZ: 5,
  }, { seed: 42 });
  assert.ok(large.some(item => item.object === "Chair"));
});

it("omits a blocked work group together with its tabletop details", () => {
  const room = {
    id: "throne-hall",
    minX: 0,
    minZ: 0,
    maxX: 4,
    maxZ: 3.75,
    level: 0,
  };
  const items = new ThroneRoomGenerator().furnish(room, {
    seed: 42,
    openings: [{
      roomId: room.id,
      kind: "door",
      side: "SOUTH",
      axis: "z",
      coordinate: 3.75,
      center: 3.5,
      width: 1,
    }],
  });
  assert.ok(items.some(item => item.object === "CandleStand"));
  assert.ok(!items.some(item => ["Lectern", "WritingDesk", "Table", "Book", "DeskGlobe"].includes(item.object)));
});

it("faces compact visitors toward the throne in both mirrored layouts", async () => {
  for (const seed of [42, 43]) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const chair = plan.furniture.find(item => item.role === "courtProp" && item.object === "Chair");
    // The GLB's back is on +X: its front after yaw points (-cos(yaw), sin(yaw)).
    assert.ok(Math.abs(Math.cos(chair.rotation * Math.PI / 180)) < 0.0001);
    assert.ok(Math.sin(chair.rotation * Math.PI / 180) < -0.99);
  }
});

it("publishes actual prop definitions once and replaces old furnishings on regeneration", async () => {
  const definition = {
    id: "court-test",
    object: "Castle",
    position: {
      x: -14,
      z: -8,
      width: 28,
      depth: 16,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 13,
      width: 2,
    }],
    basePlanId: "castle-demo-compact",
    seed: 42,
  };
  definition.buildPlan = await CastleAuthoredBuildPlan.generate(definition);
  const map = {
    cols: 42,
    rows: 32,
    objects: [definition],
  };
  ThroneRoomMapObjects.prepareMap(map);
  const banners = map.objects.filter(item => item.object === "Banner");
  assert.equal(banners.length, 2);
  for (const banner of banners) {
    assert.deepEqual(banner.stretch, {
      x: 0.975,
      y: 1.4,
      z: 1,
    });
    const dais = map.objects.find(item => item.object === "ThroneDais");
    assert.ok(Math.abs(banner.position.y - dais.position.y - 2.3) < 0.00001);
  }
  const first = structuredClone(map.objects);
  ThroneRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, first);
  assert.ok(map.objects.some(item => ["Lectern", "WritingDesk", "Table"].includes(item.object)));
  definition.buildPlan = await CastleAuthoredBuildPlan.generate({
    ...definition,
    seed: 48,
  });
  ThroneRoomMapObjects.prepareMap(map);
  assert.equal(map.objects.filter(item => item.courtFurnishing).length,
    definition.buildPlan.metadata.runtime.residential.furniture.filter(item => item.role === "courtProp").length);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
});

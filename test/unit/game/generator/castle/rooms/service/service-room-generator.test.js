import assert from "node:assert/strict";
import { test } from "node:test";
import { ServiceRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/service/ServiceRoomGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleResidentialLayout } from "../../../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { KitchenRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/kitchen/KitchenRoomMapObjects.js";

const generator = new ServiceRoomGenerator();
const room = {
  id: "quarters",
  purpose: "Service quarters",
  minX: 0,
  maxX: 5,
  minZ: 0,
  maxZ: 5,
  floorY: 0,
  height: 3,
  level: 0,
};

test("service furnishing repeats and varies without another room consuming its stream", () => {
  const first = generator.furnish(room, { seed: 20 });
  generator.furnish({
    ...room,
    id: "other",
  }, { seed: 20 });
  assert.deepEqual(generator.furnish(room, { seed: 20 }), first);
  assert.notDeepEqual(generator.furnish(room, { seed: 22 }), first);
  assert.ok(first.some(item => item.role === "servantBed"));
  assert.ok(first.some(item => item.object === "BedsideDrawers"));
});

test("authored purposes distinguish royal bedrooms, barracks, and supply rooms", () => {
  for (const purpose of ["Armory", "Pantry", "Storage", "Kitchen", "Dining hall", "Guard room"]) {
    assert.ok(generator.furnish({
      ...room,
      purpose,
    }).every(item => !item.role.includes("Bed")));
  }
  const royal = generator.furnish({
    ...room,
    purpose: "Royal chamber",
  });
  assert.ok(royal.some(item => item.role === "royalBed"));
  assert.ok(royal.some(item => item.role === "wardrobe"));
  assert.ok(!royal.some(item => item.role === "servantBed"));
  assert.ok(generator.furnish({
    ...room,
    purpose: "Captain room",
  }).some(item => item.role === "servantBed"));
  assert.ok(generator.furnish({
    ...room,
    maxX: 8,
    maxZ: 8,
    purpose: "Barracks",
  }).filter(item => item.role === "servantBed").length >= 2);
});

test("compact seeded furnishing leaves bounds, door swing, stair bay, and supported details valid", () => {
  for (let seed = 0; seed < 60; seed++) {
    const compact = {
      ...room,
      maxX: 2.5,
      maxZ: 3.2,
    };
    const context = {
      seed,
      openings: [{
        roomId: room.id,
        floorY: 0,
        kind: "door",
        axis: "z",
        coordinate: 0,
        center: 1.25,
        width: 0.8,
      }],
      stairs: [{
        minX: 1.7,
        maxX: 2.5,
        minZ: 2.5,
        maxZ: 3.2,
        from: 0,
        to: 1,
      }],
    };
    const items = generator.furnish(compact, context);
    for (const item of items) {
      const hx = item.width * item.scale / 2, hz = item.depth * item.scale / 2;
      assert.ok(item.x - hx >= 0.18 - 1e-5 && item.x + hx <= compact.maxX - 0.18 + 1e-5);
      assert.ok(item.z - hz >= 0.18 - 1e-5 && item.z + hz <= compact.maxZ - 0.18 + 1e-5);
      assert.ok(!(item.x + hx > 1.25 && item.z + hz > 2.05));
      if (item.supportId) {
        const support = items.find(candidate => candidate.id === item.supportId);
        assert.ok(support);
        assert.equal(item.y, item.underSupport ? 0 : support.height * support.scale);
        assert.ok(hx <= support.width / 2 && hz <= support.depth / 2);
      }
    }
  }
});

test("different room sizes keep seeded floor props separate and retain sleeping-room beds", () => {
  for (const [maxX, maxZ] of [[2, 2.5], [3, 4], [5, 5], [8, 8]]) {
    for (let seed = 0; seed < 40; seed++) {
      const items = generator.furnish({
        ...room,
        maxX,
        maxZ,
      }, { seed });
      assert.ok(items.some(item => item.role === "servantBed"));
      const floor = items.filter(item => !item.supportId && (item.y ?? 0) < 0.9 && item.height * item.scale > 0.05);
      for (let first = 0; first < floor.length; first++) {
        for (let second = first + 1; second < floor.length; second++) {
          const a = floor[first], b = floor[second];
          const separatesX = Math.abs(a.x - b.x) >= (a.width * a.scale + b.width * b.scale) / 2 + 0.1199;
          const separatesZ = Math.abs(a.z - b.z) >= (a.depth * a.scale + b.depth * b.scale) / 2 + 0.1199;
          assert.ok(separatesX || separatesZ);
        }
      }
    }
  }
});

test("quarters provide cozy, mending and steward layouts with supported work details", () => {
  const variants = new Map();
  for (let seed = 0; seed < 20; seed++) {
    const items = generator.furnish(room, { seed });
    variants.set(items[0].furnishingVariant, items);
    assert.ok(items.some(item => item.object === "Rug"));
    assert.ok(items.some(item => item.object === "FoldedLinens"));
    for (const item of items.filter(item => item.supportId)) {
      const support = items.find(candidate => candidate.id === item.supportId);
      assert.equal(item.y, item.underSupport ? 0 : support.height * support.scale);
      assert.ok(Math.abs(item.x - support.x) + item.width / 2 <= support.width * support.scale / 2 + 1e-5);
      assert.ok(Math.abs(item.z - support.z) + item.depth / 2 <= support.depth * support.scale / 2 + 1e-5);
    }
  }
  assert.deepEqual([...variants.keys()].sort(), ["cozy", "mending", "steward"]);
  assert.ok(variants.get("cozy").some(item => item.object === "WashBasin"));
  const sewing = variants.get("mending").find(item => item.object === "Basket");
  assert.deepEqual(sewing.items.map(item => item.object),
    ["ClothRoll", "ClothRoll", "ThreadSpool", "ThreadSpool", "ThreadSpool"]);
  assert.deepEqual(sewing.items.map(item => item.variant), ["cream", "blue", "tilted", "small", "large"]);
  assert.ok(sewing.items.every(item => item.position.y > 0.15));
  assert.equal(new Set(sewing.items.map(item => JSON.stringify(item.position))).size, 5);
  assert.equal(sewing.items[0].scale, 1);
  assert.ok(variants.get("steward").some(item => item.object === "OpenReadingBook"));
});

test("service props enter actual authored-plan furniture for both mirrored seeds", async () => {
  for (const seed of [2, 3, 4]) {
    const plan = await CastleBasePlanGenerator.generate({
      planId: "castle-01",
      seed,
      unitMetres: 0.3,
    });
    const chamber = plan.furniture.filter(item => item.roomId === "royal-chamber");
    assert.ok(chamber.some(item => item.role === "royalBed"));
    assert.ok(plan.furniture.some(item => item.role === "serviceProp" && item.object));
    for (const item of plan.furniture.filter(item => item.role === "serviceProp" && item.supportId)) {
      assert.ok(plan.furniture.some(candidate => candidate.id === item.supportId && candidate.roomId === item.roomId));
    }
  }
});

test("authored service props publish once with supported heights and rotated resident footprints", async () => {
  const buildPlan = await CastleAuthoredBuildPlan.generate({
    basePlanId: "castle-01",
    seed: 2,
    position: {
      x: 0,
      z: 0,
      width: 32,
      depth: 19.2,
      elevation: 2,
    },
    doors: [{
      side: "NORTH",
      offset: 13.5,
      width: 2,
    }],
  });
  const map = {
    cols: 60,
    rows: 60,
    objects: [{
      id: "castle-service-test",
      object: "Castle",
      buildPlan,
    }],
  };
  const furniture = buildPlan.metadata.runtime.residential.furniture;
  const service = furniture.filter(item => item.role === "serviceProp");
  assert.ok(service.some(item => item.object === "BedsideDrawers"));
  assert.ok(service.some(item => item.object === "TableCandles"));
  KitchenRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects);
  KitchenRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, first);
  assert.equal(map.objects.filter(item => item.sourceCastleId).length, service.length + furniture.filter(item => item.role === "kitchenProp").length);
  const layout = new CastleResidentialLayout(buildPlan);
  for (const item of service) {
    const index = furniture.indexOf(item);
    const definition = map.objects.find(candidate => candidate.id === `castle-service-test-kitchen-prop-${index}`);
    assert.ok(definition);
    assert.equal(definition.position.y, item.floorY + (item.y ?? 0));
    assert.equal(definition.rotation, layout.yaw + 180 + item.rotation);
    if (item.items) { assert.deepEqual(definition.items, item.items); }
  }
  const bed = furniture.find(item => item.role === "royalBed");
  const placement = layout.placements.find(item => item.role === "royalBed");
  assert.equal(placement.footprint.width, bed.width * bed.scale);
  assert.equal(placement.footprint.depth, bed.depth * bed.scale);
});

test("the compact castle publishes each requested quarters variant as normal map objects", async () => {
  for (const [seed, variant, detail] of [[2, "cozy", "WashBasin"], [0, "mending", "Basket"], [17, "steward", "OpenReadingBook"]]) {
    const buildPlan = await CastleAuthoredBuildPlan.generate({
      basePlanId: "castle-demo-compact",
      seed,
      position: {
        x: -6.5,
        z: -5.5,
        width: 12,
        depth: 11,
        elevation: 0,
      },
      doors: [{
        side: "NORTH",
        offset: 5,
        width: 2,
      }],
    });
    const furniture = buildPlan.metadata.runtime.residential.furniture.filter(item => item.roomId === "service-quarters");
    assert.ok(furniture.length);
    assert.ok(furniture.every(item => item.furnishingVariant === variant));
    const map = {
      cols: 30,
      rows: 30,
      objects: [{
        id: "quarters-castle",
        object: "Castle",
        buildPlan,
      }],
    };
    KitchenRoomMapObjects.prepareMap(map);
    for (const object of ["Rug", "FoldedLinens", detail]) {
      assert.ok(map.objects.some(item => item.object === object && item.sourceCastleId === "quarters-castle"));
    }
  }
});

import { LibraryRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/library/LibraryRoomMapObjects.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { RoyalBedroomRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/royal-bedroom/RoyalBedroomRoomGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { RoyalBedroomRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/royal-bedroom/RoyalBedroomRoomMapObjects.js";
import { CastleResidentialLayout } from "../../../../../../../src/game/objects/castle/CastleResidentialLayout.js";

const generator = new RoyalBedroomRoomGenerator();
const room = { id: "royal-chamber", purpose: "Royal sleeping room", minX: 0.375, maxX: 3.625,
  minZ: 3.875, maxZ: 7.625, floorY: -3, level: -1, height: 3 };
const openings = [
  { roomId: "service-quarters", floorY: -3, kind: "door", axis: "z", coordinate: 3.875, center: 0.875, width: 1 },
  { roomId: "kitchen", floorY: -3, kind: "door", axis: "x", coordinate: 3.625, center: 6.875, width: 1 },
];

test("royal layouts repeat independently and all five concepts have distinct arrangements", () => {
  const signatures = new Set();
  for (let variant = 0; variant < 5; variant++) {
    const context = { seed: variant * 2, openings };
    const items = generator.furnish(room, context);
    generator.furnish({ ...room, id: "another-bedroom" }, { seed: 99 });
    assert.deepEqual(generator.furnish(room, context), items);
    assert.deepEqual(generator.furnish(room, { ...context, seed: variant * 2 + 1 }), items);
    assert.ok(items.every(item => item.furnishingVariant === RoyalBedroomRoomGenerator.variations[variant]));
    assert.equal(items.filter(item => item.role === "royalBed").length, 1);
    assert.ok(items.some(item => item.role === "wardrobe"));
    assert.ok(items.some(item => item.object === "BedsideDrawers"));
    assert.ok(items.some(item => item.object === "TableCandles"));
    assert.ok(items.some(item => item.object === "Rug"));
    if (variant === 1) { assert.ok(items.some(item => item.object === "WritingDesk")); }
    assert.ok(!items.some(item => item.object === "Throne"));
    if (variant === 2) { assert.ok(items.some(item => item.object === "Chair")); }
    if (variant === 4) { assert.ok(items.some(item => item.object === "WashBasin")); }
    signatures.add(JSON.stringify(items.map(item => [item.object ?? item.role, item.x, item.z, item.rotation])));
  }
  assert.equal(signatures.size, 5);
});

test("bedroom props stay inside the room, clear neighbouring door swings and keep supported items grounded", () => {
  for (const [width, depth] of [[3.25, 3.75], [4, 4], [6, 5]]) {
    for (let seed = 0; seed < 10; seed++) {
      const bounds = { ...room, maxX: room.minX + width, maxZ: room.minZ + depth };
      const items = generator.furnish(bounds, { seed, openings: openings.slice(0, 1) });
      assert.ok(items.some(item => item.role === "royalBed"));
      for (const item of items) {
        const halfX = item.width * item.scale / 2, halfZ = item.depth * item.scale / 2;
        assert.ok(item.x - halfX >= bounds.minX + (item.wallAttachment ? 0 : 0.15) - 1e-6);
        assert.ok(item.x + halfX <= bounds.maxX - (item.wallAttachment ? 0 : 0.15) + 1e-6);
        assert.ok(item.z - halfZ >= bounds.minZ + (item.wallAttachment ? 0 : 0.15) - 1e-6);
        assert.ok(item.z + halfZ <= bounds.maxZ - (item.wallAttachment ? 0 : 0.15) + 1e-6);
        if (item.supportId) {
          const support = items.find(candidate => candidate.id === item.supportId);
          assert.ok(support);
          assert.equal(item.y, support.height * support.scale);
          assert.ok(halfX <= support.width * support.scale / 2);
          assert.ok(halfZ <= support.depth * support.scale / 2);
        }
        if (item.floorCovering || item.supportId || item.wallAttachment) { continue; }
        assert.ok(!(item.x + halfX > 0.225 && item.x - halfX < 1.525 && item.z - halfZ < 5.125),
          "a neighbour-authored north door retains its full swing");
        for (const other of items) {
          if (item === other || other.supportId || other.floorCovering || other.wallAttachment) { continue; }
          assert.ok(Math.abs(item.x - other.x) >= halfX + other.width * other.scale / 2 - 1e-6 ||
            Math.abs(item.z - other.z) >= halfZ + other.depth * other.scale / 2 - 1e-6,
          `${item.object ?? item.role} intersects ${other.object ?? other.role}`);
        }
      }
    }
  }
});

test("the tower binds the dedicated generator and preserves the mirrored inventory", async () => {
  for (const seed of [2, 8, 14, 20, 26]) {
    const original = await CastleBasePlanGenerator.generate({ seed });
    const mirrored = await CastleBasePlanGenerator.generate({ seed: seed + 1 });
    assert.equal(original.spaces.find(space => space.id === room.id).generator, "RoyalBedroomRoomGenerator");
    const first = original.furniture.filter(item => item.roomId === room.id);
    const second = mirrored.furniture.filter(item => item.roomId === room.id);
    assert.equal(second.length, first.length);
    for (const [index, item] of first.entries()) {
      assert.equal(second[index].x, original.entrance.center * 2 - item.x);
      assert.equal(second[index].z, item.z);
      assert.equal(second[index].object, item.object);
    }
  }
});

test("both tower plans publish five furnished variations in every castle orientation", async () => {
  for (const [basePlanId, seeds] of [["castle-compact-tower", [2, 8, 14, 20, 26]],
    ["castle-compact-service-wing", [4, 10, 16, 22, 28]]]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      for (const seed of seeds) {
        const plan = await CastleAuthoredBuildPlan.generate({ basePlanId, seed,
          position: { x: -8, z: -8, width: 16, depth: 16, elevation: 2 }, doors: [{ side, offset: 7, width: 2 }] });
        const residential = plan.metadata.runtime.residential;
        const items = residential.furniture.filter(item => item.roomId === room.id);
        assert.ok(items.length > 3);
        assert.ok(items.some(item => item.role === "royalBed"));
        assert.ok(items.some(item => item.role === "wardrobe"));
        assert.ok(items.every(item => !item.placementIssue));
        const castle = { id: "bedroom-castle", object: "Castle", buildPlan: plan };
        const map = { cols: 42, rows: 42, objects: [castle] };
        RoyalBedroomRoomMapObjects.prepareMap(map);
        const definitions = structuredClone(map.objects.slice(1));
        RoyalBedroomRoomMapObjects.prepareMap(map);
        assert.deepEqual(map.objects.slice(1), definitions);
        assert.equal(definitions.length, items.filter(item => item.role === "royalBedroomProp").length);
        assert.ok(items.some(item => item.object === "Bookshelf"));
        assert.equal(items.filter(item => item.object === "WritingDesk").length, 1);
        assert.ok(!items.some(item => item.object === "LibrarySideTable"));
        LibraryRoomMapObjects.prepareMap(map);
        assert.ok(map.objects.some(item => item.object === "Bookshelf" && item.id.includes(room.id)));
        const layout = new CastleResidentialLayout(plan);
        const bedroom = residential.rooms[room.id];
        assert.equal(bedroom.maxX - bedroom.minX, basePlanId === "castle-compact-service-wing" ? 3.25 : 7.25);
        for (const z of [bedroom.minZ + 0.5, (bedroom.minZ + bedroom.maxZ) / 2, bedroom.maxZ - 0.5]) {
          const point = layout.toWorld((bedroom.minX + bedroom.maxX) / 2, z, bedroom.floorY - layout.origin.y + 1);
          assert.ok(!plan.metadata.collision.cameraBlocks.some(box =>
            Math.abs(point.x - box.x) < box.halfX && Math.abs(point.y - box.y) < box.halfY &&
            Math.abs(point.z - box.z) < box.halfZ), "the old bedroom/kitchen divider is removed from actual masonry");
        }
        for (const item of items.filter(item => item.role === "royalBedroomProp")) {
          const definition = definitions.find(candidate => candidate.id === `${castle.id}-${item.id}`);
          assert.ok(definition);
          assert.equal(definition.object, item.object);
          assert.deepEqual(definition.position, layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0)));
          assert.equal(definition.scale, item.scale);
        }
      }
    }
  }
});

test("the saved ladder castle contains the new side-tower bedroom instead of the old empty passage", () => {
  const map = JSON.parse(readFileSync(new URL("../../../../../../../src/game/maps/tests/ladder-castle.json", import.meta.url), "utf8"));
  const plan = map.objects.find(object => object.object === "Castle").buildPlan.metadata.runtime.residential;
  assert.equal(plan.basePlanId, "castle-compact-service-wing");
  assert.equal(plan.furniture.find(item => item.roomId === "royal-chamber" && item.role === "royalBed").height, 2.03);
  assert.ok(plan.furniture.some(item => item.roomId === "royal-chamber" && item.object === "Rug" && item.model === "royal-bedroom-rug.glb" && item.floorCovering));
  assert.ok(!plan.furniture.some(item => item.roomId === "royal-chamber" && item.object === "VestibuleBanner"));
  const painting = plan.furniture.find(item => item.roomId === "royal-chamber" && item.object === "Painting" && item.variant === "royal-bedroom");
  const bed = plan.furniture.find(item => item.roomId === "royal-chamber" && item.role === "royalBed");
  assert.ok(painting?.wallAttachment);
  assert.equal((painting.rotation - bed.rotation + 360) % 360, 180);
  assert.ok(!plan.furniture.some(item => item.roomId === "royal-chamber" && item.object === "Painting" && item.variant === "vestibule"));
  assert.ok(plan.furniture.some(item => item.roomId === "royal-chamber" && item.role === "royalBed"));
  assert.ok(plan.spaces.some(space => space.id === "royal-chamber" && space.maxX - space.minX === 3.25 && space.maxZ - space.minZ === 7.25));
  assert.ok(!plan.spaces.some(space => space.purpose === "Kitchen and storeroom passage"));
});


test("long bedrooms swap the sleeping and study ends while retaining their real doorway", () => {
  const bounds = { ...room, minZ: 0.375, maxZ: 7.625 };
  const doors = [{ roomId: "kitchen", floorY: -3, kind: "door", axis: "x", side: "EAST",
    coordinate: bounds.maxX, center: 5.25, width: 1.25, height: 2.5, swing: "inward" }];
  const original = structuredClone(doors);
  const items = generator.furnish(bounds, { seed: 10, openings: doors });
  const middle = (bounds.minZ + bounds.maxZ) / 2;
  assert.ok(items.find(item => item.role === "royalBed").z < middle);
  assert.ok(items.find(item => item.object === "WritingDesk").z > middle);
  assert.deepEqual(doors, original);
});

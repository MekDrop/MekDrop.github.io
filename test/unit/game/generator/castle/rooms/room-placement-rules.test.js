import assert from "node:assert/strict";
import { test } from "node:test";
import { RoomPlacementRules } from "../../../../../../src/game/generator/castle/rooms/RoomPlacementRules.js";

const room = { minX: 0, maxX: 4, minZ: 0, maxZ: 4, floorY: 0, height: 3 };
const shelf = { id: "shelf", role: "storageShelf", x: 2, z: 2, width: 0.8, depth: 0.3, height: 1, scale: 1 };

test("ordinary props respect the inside wall face, even with a wallInset field", () => {
  assert.equal(RoomPlacementRules.accepts({ ...shelf, x: 0.4 }, room, []), false);
  assert.equal(RoomPlacementRules.accepts({ ...shelf, x: 0.4, wallInset: 1 }, room, []), false);
  assert.equal(RoomPlacementRules.accepts({ ...shelf, x: 0.55 }, room, []), true);
  assert.equal(RoomPlacementRules.accepts({ ...shelf, x: 0.4, wallAttachment: true }, room, []), true);
});

test("props cannot intersect another prop, but supported contact is allowed", () => {
  const linen = { id: "linen", role: "serviceProp", x: 2, z: 2, width: 0.3, depth: 0.22, height: 0.16, scale: 1, supportId: "shelf" };
  assert.equal(RoomPlacementRules.accepts(linen, room, [shelf]), false);
  assert.equal(RoomPlacementRules.accepts({ ...linen, y: 1 }, room, [shelf]), true);
  assert.equal(RoomPlacementRules.accepts({ ...linen, y: 1 }, room, []), false);
  assert.equal(RoomPlacementRules.accepts({ ...shelf, id: "other", x: 2.1 }, room, [shelf]), false);
  assert.equal(RoomPlacementRules.accepts({ ...shelf, id: "other", x: 2.8 }, room, [shelf]), true);
});

import { CastleBasePlanGenerator } from "../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";

test("repairs all enabled layouts without deleting the original room inventory", async () => {
  for (const seed of [0, 1, 2, 3, 4, 5]) {
    const original = await CastleBasePlanGenerator.generate({ seed, baseY: 2 });
    const build = await CastleAuthoredBuildPlan.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 2 }, doors: [{ side: "NORTH", offset: 3, width: 2 }], seed });
    const repaired = build.metadata.runtime.residential.furniture;
    assert.equal(repaired.filter(item => !item.underStair).length, original.furniture.length);
    assert.deepEqual(repaired.filter(item => !item.underStair).map(item => [item.object, item.role, item.roomId]), original.furniture.map(item => [item.object, item.role, item.roomId]));
    assert.ok(repaired.every(item => !item.placementIssue), "all retained groups have a valid position");
  }
});

import { CastleAuthoredBuildPlan } from "../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";

test("fits the shelf and its supported linens outside final masonry in every castle orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [4, 5]) {
      const plan = await CastleAuthoredBuildPlan.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 2 }, doors: [{ side, offset: 3, width: 2 }], seed });
      const residential = plan.metadata.runtime.residential;
      const shelf = residential.furniture.find(item => item.role === "storageShelf" && item.roomId === "service-quarters");
      const linen = residential.furniture.find(item => item.object === "FoldedLinens" && item.supportId === shelf.id);
      assert.ok(linen, "moving the shelf retains its supported linens");
      assert.ok(residential.furniture.some(item => item.underStair), "the lower stair nook retains storage");
      const angle = residential.origin.yaw * Math.PI / 180;
      const x = residential.origin.x + Math.cos(angle) * shelf.x + Math.sin(angle) * shelf.z;
      const z = residential.origin.z - Math.sin(angle) * shelf.x + Math.cos(angle) * shelf.z;
      const crosswise = Math.abs(Math.sin(angle)) > 0.5;
      const halfX = (crosswise ? shelf.depth : shelf.width) * shelf.scale / 2;
      const halfZ = (crosswise ? shelf.width : shelf.depth) * shelf.scale / 2;
      for (const block of plan.metadata.collision.cameraBlocks) {
        if (block.y + block.halfY <= shelf.floorY + 0.005 || block.y - block.halfY >= shelf.floorY + shelf.height * shelf.scale) { continue; }
        assert.ok(Math.abs(x - block.x) >= halfX + block.halfX + 0.024 || Math.abs(z - block.z) >= halfZ + block.halfZ + 0.024, `${side}/${seed}: shelf clears the emitted masonry by 25 mm`);
      }
    }
  }
});

test("uses the minimum wall correction and moves supported details with their shelf", () => {
  const original = [{ ...shelf, x: 0.45, floorY: 0 }, { id: "linen", role: "serviceProp", object: "FoldedLinens", x: 0.45, z: 2, width: 0.3, depth: 0.22, height: 0.16, y: 1, scale: 1, floorY: 0, supportId: "shelf" }];
  const wall = { x: 0, z: 2, y: 1.5, halfX: 0.125, halfZ: 2, halfY: 1.5 };
  const repaired = RoomPlacementRules.repair(original, [wall], [{ ...room, id: "room" }]);
  assert.equal(repaired.length, original.length);
  assert.ok(Math.abs(repaired[0].x - 0.55001) < 1e-6);
  assert.ok(Math.abs(repaired[1].x - repaired[0].x) < 1e-6);
  assert.equal(repaired[0].z, original[0].z);
  assert.equal(original[0].x, 0.45, "source arrangement is not mutated");
});

test("leaves valid furnishings alone and repairs a conflicting item without dropping it", () => {
  const first = { ...shelf, floorY: 0, roomId: "room" };
  const second = { ...shelf, id: "second", x: 2.6, floorY: 0, roomId: "room" };
  const result = RoomPlacementRules.repair([first, second], [], [{ ...room, id: "room" }]);
  assert.equal(result.length, 2);
  assert.equal(result[0].x, 2);
  assert.equal(result[0].z, 2);
  assert.ok(Math.abs(result[1].x - 2.80001) < 1e-6);
  assert.equal(result[1].z, 2);
  const unchanged = RoomPlacementRules.repair([first], [], [{ ...room, id: "room" }]);
  assert.equal(unchanged[0].x, first.x);
  assert.equal(unchanged[0].z, first.z);
});

test("keeps neighboring cloak rails visually separated without removing either rail", () => {
  const rail = { role: "vestibuleProp", object: "VestibuleCloakRail", x: 1, z: 0.3, width: 1.1, depth: 0.1771, height: 1.365, scale: 0.78, y: 1.28, floorY: 0, roomId: "room" };
  const result = RoomPlacementRules.repair([{ ...rail, id: "left" }, { ...rail, id: "right", x: 1.85 }], [], [{ ...room, id: "room" }]);
  assert.equal(result.length, 2);
  assert.ok(result.every(item => !item.placementIssue));
  assert.equal(result[0].x, rail.x);
  assert.ok(result[1].x - result[0].x - rail.width * rail.scale >= 0.18);
  assert.equal(result[1].z, rail.z);
});

test("wall fixtures contact the masonry by their measured rear plane in all cardinal directions", () => {
  const mounts = { VestibuleCloakRail: -0.058, VestibulePainting: -0.024, VestibuleBanner: -0.005, HangingFryingPan: -0.0953, KitchenUtensilRail: 0 };
  for (const [object, back] of Object.entries(mounts)) {
    for (const rotation of [0, 90, 180, 270]) {
      const angle = rotation * Math.PI / 180;
      const axis = rotation % 180 ? "x" : "z";
      const sign = Math.round(axis === "x" ? Math.sin(angle) : Math.cos(angle));
      const wall = { x: 2, z: 2, y: 1.5, halfX: 2, halfZ: 2, halfY: 1.5 };
      wall[axis] = sign > 0 ? 4 : 0;
      wall[axis === "x" ? "halfX" : "halfZ"] = 0.125;
      const item = { ...shelf, id: object, object, rotation, floorY: 0, y: 1, height: 0.5, scale: 0.8 };
      item[axis] = sign > 0 ? 3.7 : 0.3;
      const [fixed] = RoomPlacementRules.repair([item], [wall], [room]);
      const face = wall[axis] - sign * 0.125;
      assert.ok(Math.abs(fixed[axis] - sign * back * item.scale - face) < 1e-6, object + rotation);
      assert.equal(fixed.placementIssue, undefined);
      assert.equal(fixed[axis === "x" ? "z" : "x"], 2);
    }
  }
});


test("bookshelves sit close to the wall without embedding their cabinet depth", () => {
  const item = { ...shelf, object: "Bookshelf", floorY: 0, rotation: 0, width: 0.85, depth: 0.36, z: 3.4 };
  const wall = { x: 2, z: 4, y: 1.5, halfX: 2, halfZ: 0.125, halfY: 1.5 };
  const [fixed] = RoomPlacementRules.repair([item], [wall], [room]);
  assert.ok(Math.abs(fixed.z + 0.18 + 0.02501 - 3.875) < 1e-6);
  assert.equal(fixed.wallAttachment, undefined);
});

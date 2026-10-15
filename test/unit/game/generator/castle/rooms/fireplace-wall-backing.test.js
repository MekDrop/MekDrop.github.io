import assert from "node:assert/strict";
import { test } from "node:test";
import { FireplaceWallBacking } from "../../../../../../src/game/generator/castle/rooms/FireplaceWallBacking.js";
import { KitchenRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/KitchenRoomGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";

const room = { id: "kitchen", minX: 0, maxX: 4, minZ: 0, maxZ: 4, floorY: 0, height: 3, level: 0 };
const hearth = { object: "KitchenFireplace", x: 2, z: 0.1875, width: 1.407, depth: 0.815, scale: 1, y: 0 };
const wall = { x: 2, y: 1.5, z: 0, halfX: 2, halfY: 1.5, halfZ: 0.125 };

test("fireplaces require actual masonry and cannot float away from their original backing wall", () => {
  assert.equal(FireplaceWallBacking.accepts(hearth, room, [], [wall]), true);
  assert.equal(FireplaceWallBacking.accepts(hearth, room, [], []), false);
  assert.equal(FireplaceWallBacking.accepts({ ...hearth, z: 1 }, room, [], [wall]), false);
  assert.equal(FireplaceWallBacking.accepts({ ...hearth, z: 3.8125 }, room, [], [wall], hearth), false);
});

test("doors and windows authored by either adjacent room invalidate the full hearth/chimney backing", () => {
  for (const roomId of [room.id, "neighbour"]) {
    for (const [kind, bottom, height] of [["door", 0, 2.5], ["window", 0.8, 1], ["window", 2, 0.75]]) {
      const opening = { roomId, floorY: 0, kind, axis: "z", coordinate: 0, center: 2.4, width: 0.8, bottom, height };
      assert.equal(FireplaceWallBacking.accepts(hearth, room, [opening], [wall]), false);
      assert.equal(FireplaceWallBacking.accepts(hearth, room, [{ ...opening, floorY: 3 }], [wall]), true);
    }
  }
});

test("kitchen generation moves a hearth beside a neighbour's aperture or omits it when the wall is fully open", () => {
  const generator = new KitchenRoomGenerator();
  const openings = [{ roomId: "neighbour", floorY: 0, kind: "door", axis: "z", coordinate: 0, center: 0.85, width: 1.25, bottom: 0, height: 2.5 }];
  const moved = generator.furnish(room, { seed: 2, openings }).find(item => item.object === "KitchenFireplace");
  assert.ok(moved);
  assert.equal(FireplaceWallBacking.accepts(moved, room, openings), true);
  const blocked = generator.furnish(room, { openings: [{ ...openings[0], center: 2, width: 4 }] });
  assert.ok(!blocked.some(item => ["KitchenFireplace", "FireplaceCauldron"].includes(item.object)));
});

test("final repaired side-tower fireplaces retain solid backing in every orientation and mirrored layout", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    for (const seed of [4, 5, 10, 11]) {
      const plan = await CastleAuthoredBuildPlan.generate({ seed,
        position: { x: -8, z: -8, width: 16, depth: 16, elevation: 3 }, doors: [{ side, offset: 7, width: 2 }] });
      const residential = plan.metadata.runtime.residential;
      const hearth = residential.furniture.find(item => item.object === "KitchenFireplace");
      assert.ok(hearth);
      assert.ok(!hearth.placementIssue);
      assert.equal(FireplaceWallBacking.accepts(hearth, residential.rooms.kitchen, residential.openings), true);
    }
  }
});

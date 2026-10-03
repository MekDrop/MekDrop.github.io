import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleRoomLocator } from "../../../../../../../src/game/plugins/game-canvas/debug-ui/debug/CastleRoomLocator.js";

it("shows the occupied storey even when feet sit below its floor surface", () => {
  const spaces = [-3, 0, 3].map((floorY) => ({
    id: `room:${floorY}`, kind: "room", floorY, height: 3,
    minX: -1, maxX: 1, minZ: -1, maxZ: 1,
  }));
  const plan = { origin: { x: 10, z: 20, yaw: 90 }, spaces };
  for (const floorY of [-3, 0, 3]) {
    for (const offset of [-0.25, -0.06, 0, 0.1]) {
      assert.equal(CastleRoomLocator.locate(plan, { x: 10, z: 20, y: floorY + offset }).id, `room:${floorY}`);
    }
  }
  assert.equal(CastleRoomLocator.locate(plan, { x: 12, z: 20, y: 0 }), null);
});

it("retains a tall room in its open upper volume", () => {
  const room = { id: "hall", kind: "room", floorY: 0, height: 6, minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
  const plan = { origin: { x: 0, z: 0 }, spaces: [room, { ...room, kind: "void", floorY: 3 }] };
  assert.equal(CastleRoomLocator.locate(plan, { x: 1, z: 1, y: 3 }), room);
});

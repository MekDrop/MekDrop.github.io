import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";

it("seats every interior door frame against masonry on both faces", async () => {
  for (const seed of [4, 5]) {
    for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
      const build = await CastleGenerator.generate({
        position: {
          x: -14,
          z: -8,
          width: 28,
          depth: 16,
          elevation: 3,
        },
        doors: [{
          side,
          offset: 13,
          width: 2,
        }],
        seed,
      });
      for (const door of build.metadata.runtime.roomDoors) {
        // The inspected frame's front face is at local Z=0.19, with Z scale
        // 0.5. It must meet the wall plane instead of projecting into the room.
        assert.ok(Math.abs(door.frameOffset + 0.19 * 0.5) < 1e-6,
          `${seed}/${side}/${door.roomId}: frame front sits in the wall plane`);
        const angle = door.yaw * Math.PI / 180;
        for (const depth of [-0.24, -0.01]) {
          for (const [across, height] of [
            [-door.width * 0.59 - 0.005, door.height / 2],
            [door.width * 0.59 + 0.005, door.height / 2],
            [0, door.height + 0.005],
          ]) {
            const point = {
              x: door.x + across * Math.cos(angle) + depth * Math.sin(angle),
              z: door.z - across * Math.sin(angle) + depth * Math.cos(angle),
              y: door.y + height,
            };
            assert.ok(build.metadata.collision.cameraBlocks.some(block =>
              Math.abs(point.x - block.x) <= block.halfX + 1e-6 &&
              Math.abs(point.y - block.y) <= block.halfY + 1e-6 &&
              Math.abs(point.z - block.z) <= block.halfZ + 1e-6),
            `${seed}/${side}/${door.roomId}: masonry meets frame at ${across}, ${height}, ${depth}`);
          }
        }
      }
    }
  }
});


it("keeps the frame front inside the wall opening for every enabled layout", async () => {
  for (const seed of [0, 1, 2, 3, 4, 5]) {
    const build = await CastleGenerator.generate({
      position: {
        x: -4,
        z: -4,
        width: 8,
        depth: 8,
        elevation: 2,
      },
      doors: [{
        side: "NORTH",
        offset: 3,
        width: 2,
      }],
      seed,
    });
    for (const door of build.metadata.runtime.roomDoors) {
      const angle = door.yaw * Math.PI / 180;
      const across = door.width * 0.59 + 0.02;
      const depth = door.frameOffset - (door.openingInset ?? 0) + 0.095;
      assert.ok([-1, 1].some(sign => {
        const x = door.x + sign * across * Math.cos(angle) + depth * Math.sin(angle);
        const z = door.z - sign * across * Math.sin(angle) + depth * Math.cos(angle);
        return build.metadata.collision.cameraBlocks.some(block => Math.abs(x - block.x) <= block.halfX + 1e-6 &&
          Math.abs(z - block.z) <= block.halfZ + 1e-6 && Math.abs(door.y + 1 - block.y) <= block.halfY);
      }), `${seed}/${door.roomId}: frame front meets actual jamb masonry`);
    }
  }
});

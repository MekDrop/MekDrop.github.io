import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { VestibuleRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/VestibuleRoomGenerator.js";

it("furnishes the arrival room while preserving circulation and window approaches in both mirrors", async () => {
  for (const seed of [20, 21]) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const items = plan.furniture.filter(item => item.role === "vestibuleProp");
    for (const object of ["VestibuleBench", "VestibuleCloakRail", "VestibuleBanner", "VestibuleRug", "VestibuleLantern",
      "VestibulePainting", "VestibuleArmorDisplay", "WoodenStorageChest", "VestibuleTravelKit", "VestibuleBoots", "VestibuleStickStand"]) {
      assert.ok(items.some(item => item.object === object), `${object} seed ${seed}`);
    }
    for (const room of plan.spaces.filter(room => room.id.startsWith("vestibule"))) {
      assert.ok(items.some(item => item.roomId === room.id));
      for (const item of items.filter(item => item.roomId === room.id)) {
        const halfX = item.width * item.scale / 2;
        const halfZ = item.depth * item.scale / 2;
        assert.ok(item.x - halfX >= room.minX - 1e-6 && item.x + halfX <= room.maxX + 1e-6);
        assert.ok(item.z - halfZ >= room.minZ - 1e-6 && item.z + halfZ <= room.maxZ + 1e-6);
        if (["VestibuleBench", "VestibuleCloakRail", "VestibuleLantern"].includes(item.object)) {
          assert.ok(Math.abs(item.x - (room.minX + room.maxX) / 2) >= halfX + 0.6);
        }
        for (const opening of plan.openings.filter(opening => opening.floorY === room.floorY)) {
          if ((item.y ?? 0) + item.height * item.scale <= 0.05) { continue; }
          if (opening.kind === "window" && (item.y ?? 0) + item.height * item.scale <= opening.bottom - 0.1) {
            continue;
          }
          const perpendicular = opening.axis === "x" ? item.x : item.z;
          const along = opening.axis === "x" ? item.z : item.x;
          const halfPerpendicular = opening.axis === "x" ? halfX : halfZ;
          const halfAlong = opening.axis === "x" ? halfZ : halfX;
          assert.ok(Math.abs(perpendicular - opening.coordinate) >= halfPerpendicular + 0.85 ||
            Math.abs(along - opening.center) >= halfAlong + opening.width / 2 + 0.25);
        }
      }
    }
    const bench = items.find(item => item.object === "VestibuleBench");
    const cloaks = items.filter(item => item.object === "VestibuleCloakRail" && item.roomId === bench.roomId);
    assert.equal(cloaks.length, 2);
    assert.ok(cloaks.every(item => item.y > bench.y + bench.height && item.rotation === bench.rotation));
    assert.ok(Math.abs((cloaks[0].z + cloaks[1].z) / 2 - bench.z) < 1e-6);
    const painting = items.find(item => item.object === "VestibulePainting");
    const chest = items.find(item => item.object === "WoodenStorageChest");
    assert.equal(painting.z, chest.z);
    assert.ok(painting.y > chest.height * chest.scale);
    assert.ok(Math.abs(painting.x - bench.x) > 2);
    const armor = items.filter(item => item.object === "VestibuleArmorDisplay");
    assert.equal(armor.length, 1);
    assert.equal(armor[0].roomId, painting.roomId);
    assert.equal(armor[0].rotation, painting.rotation);
    assert.ok(armor[0].z > painting.z, "use the spacious side opposite the stairs door");
    assert.ok(Math.abs(armor[0].z - painting.z) >= (armor[0].depth + painting.depth) / 2 + 0.08);
    const runner = items.find(item => item.object === "VestibuleRug" && item.roomId === bench.roomId);
    assert.ok(runner.depth > 3 && runner.width === 1.3);
    const window = plan.openings.find(opening => opening.roomId === bench.roomId && opening.kind === "window");
    const windowBench = items.find(item => item.object === "VestibuleBench" && item.stretch?.x === 0.8);
    assert.ok(windowBench, `window bay furnished for seed ${seed}`);
    assert.ok(windowBench.y + windowBench.height * windowBench.scale < window.bottom);
    assert.equal(windowBench.height * windowBench.scale, bench.height * bench.scale);
    const arrivalRoom = plan.spaces.find(room => room.id === bench.roomId);
    assert.ok(runner.depth >= arrivalRoom.maxZ - arrivalRoom.minZ - 0.13);
    assert.ok(items.some(item => item.object === "TerracePlanter"));
  }
});

it("uses both window bays in a long vestibule and keeps tall furniture away from their glass", () => {
  const room = { id: "vestibule", minX: 0, maxX: 3.5, minZ: 0, maxZ: 7, level: 0, floorY: 0 };
  const openings = [3.5, 5.8].map(center => ({ roomId: room.id, kind: "window", axis: "x",
    coordinate: 0, center, width: 0.9, bottom: 1, height: 1.2, floorY: 0 }));
  const items = new VestibuleRoomGenerator().furnish(room, { openings });
  const benches = items.filter(item => item.object === "VestibuleBench" && item.stretch?.x === 0.8);
  assert.equal(benches.length, 2);
  assert.deepEqual(benches.map(item => item.z), openings.map(opening => opening.center));
  for (const opening of openings) {
    for (const item of items.filter(item => Math.abs(item.x - opening.coordinate) < item.width * item.scale / 2 + 0.85 &&
      Math.abs(item.z - opening.center) < item.depth * item.scale / 2 + opening.width / 2 + 0.25)) {
      if ((item.y ?? 0) + item.height * item.scale <= 0.05) { continue; }
      assert.ok((item.y ?? 0) + item.height * item.scale <= opening.bottom - 0.1, item.object);
    }
  }
});

it("leaves cramped and fully occupied stair rooms unfurnished", () => {
  const generator = new VestibuleRoomGenerator();
  const room = { id: "vestibule", minX: 0, maxX: 1, minZ: 0, maxZ: 1, level: 0, floorY: 0 };
  assert.deepEqual(generator.furnish(room), []);
  assert.deepEqual(generator.furnish({ ...room, maxX: 3, maxZ: 4 }, {
    stairs: [{ from: 0, to: 1, minX: 0, maxX: 3, minZ: 0, maxZ: 4 }],
  }), []);
});

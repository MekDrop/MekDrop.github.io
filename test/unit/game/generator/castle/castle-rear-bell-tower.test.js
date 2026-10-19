import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleFloorFinish } from "../../../../../src/game/objects/castle/structure/CastleFloorFinish.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";

it("keeps storeroom racks against solid walls and facing clear aisles after mirroring and rotation", async () => {
  const map = JSON.parse(await readFile(new URL("../../../../../src/game/maps/tests/castle-rear-bell-tower.json", import.meta.url), "utf8"));
  const castle = map.objects.find(item => item.object === "Castle");
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [0, 1]) {
      const plan = await CastleGenerator.generate({
        ...castle,
        seed,
        doors: [{
          ...castle.doors[0],
          side,
        }],
      });
      const layout = new CastleResidentialLayout(plan);
      const room = layout.rooms.storeroom;
      const racks = plan.metadata.runtime.authoredObjects.filter(item => item.object === "Shelf");
      assert.equal(racks.length, 2);
      for (const rack of racks) {
        const angle = rack.rotation * Math.PI / 180;
        const frontX = Math.sin(angle);
        const frontZ = Math.cos(angle);
        const back = layout.toLocal(rack.position.x - frontX * 0.15 * rack.scale, rack.position.z - frontZ * 0.15 * rack.scale);
        const clearance = Math.min(back.x - room.minX - 0.125, room.maxX - 0.125 - back.x,
          back.z - room.minZ - 0.125, room.maxZ - 0.125 - back.z);
        assert.ok(clearance >= -1e-6 && clearance <= 0.05, `${side}/${seed}: rack back is within 5 cm of the wall`);
        for (const across of [-0.59, 0, 0.59]) {
          for (const distance of [0.25, 0.75, 1.225]) {
            const x = rack.position.x + frontX * distance + Math.cos(angle) * across;
            const z = rack.position.z + frontZ * distance - Math.sin(angle) * across;
            const point = layout.toLocal(x, z);
            assert.ok(point.x > room.minX && point.x < room.maxX && point.z > room.minZ && point.z < room.maxZ,
              `${side}/${seed}: full-width metre aisle faces into the room`);
            const blocked = plan.metadata.collision.cameraBlocks.some(block => Math.abs(block.x - x) < block.halfX &&
              Math.abs(block.z - z) < block.halfZ && Math.abs(block.y - rack.position.y - 0.75) < block.halfY);
            assert.equal(blocked, false, `${side}/${seed}: solid masonry does not obstruct the aisle`);
          }
        }
      }
    }
  }
});

it("mirrors the rear tower with its corridor, doors, and walking surfaces", async () => {
  const map = JSON.parse(await readFile(new URL("../../../../../src/game/maps/tests/castle-rear-bell-tower.json", import.meta.url), "utf8"));
  const castle = map.objects.find((object) => object.object === "Castle");
  const normal = await CastleGenerator.generate({
    ...castle,
    seed: 0,
  });
  const mirrored = await CastleGenerator.generate({
    ...castle,
    seed: 1,
  });
  for (const plan of [normal, mirrored]) {
    const fixtures = plan.metadata.runtime.authoredObjects;
    const stairs = fixtures.filter(item => item.object === "SpiralStaircase");
    const bell = fixtures.find(item => item.object === "SignalBell");
    assert.equal(stairs.length, 2);
    assert.equal(stairs[0].Z2, stairs[1].Z1);
    assert.equal(stairs[1].Z2 + 0.02, bell.position.y);
    assert.equal(stairs[0].position.x, bell.position.x);
    assert.equal(stairs[0].position.z, bell.position.z);
    const roof = plan.geometry.boxes.filter(box => box.material === "castleTowerBlue");
    const towerX = (Math.min(...roof.map(box => box.x - box.sx / 2)) + Math.max(...roof.map(box => box.x + box.sx / 2))) / 2;
    const towerZ = (Math.min(...roof.map(box => box.z - box.sz / 2)) + Math.max(...roof.map(box => box.z + box.sz / 2))) / 2;
    for (const stair of stairs) {
      assert.ok(Math.abs(stair.position.x - towerX) < 1e-6, "Stair column is centered beneath the tower roof");
      assert.ok(Math.abs(stair.position.z - towerZ) < 1e-6, "Stair column shares the tower's actual bore centre");
    }
    assert.equal(fixtures.filter(item => item.object === "Shelf" && item.items.length >= 4).length, 2);
  }
  const normalDoor = normal.metadata.runtime.roomDoors.find((door) => door.roomId === "tower-terrace");
  const mirroredDoor = mirrored.metadata.runtime.roomDoors.find((door) => door.roomId === "tower-terrace");
  const entranceX = castle.position.x + castle.doors[0].offset + castle.doors[0].width / 2;
  assert.ok(Math.abs(mirroredDoor.x - (2 * entranceX - normalDoor.x)) < 1e-6, "Tower doorway follows the reflected corridor");
  assert.ok(Math.abs(mirroredDoor.z - normalDoor.z) < 1e-6);
  // Tower internals keep the spiral's handedness as the corridor moves.
  // Exclude the corridor seam, where prior masonry owns overlapping bricks.
  const normalTower = normal.geometry.boxes.filter((box) => box.z < -3.5);
  const mirroredTower = mirrored.geometry.boxes.filter((box) => box.z < -3.5);
  const key = (box) => [box.x, box.y, box.z, box.sx, box.sy, box.sz].map(value => value.toFixed(6)).join(":");
  assert.deepEqual(mirroredTower.map(key).sort(), normalTower.map((box) => key({
    ...box,
    x: box.x + mirroredDoor.x - normalDoor.x,
  })).sort());
  const normalFloors = normal.metadata.runtime.residential.walkableAreas.filter((area) => area.id.startsWith("round-tower-"));
  const mirroredFloors = mirrored.metadata.runtime.residential.walkableAreas.filter((area) => area.id.startsWith("round-tower-"));
  const floorKey = (area) => [area.minX, area.maxX, area.minZ, area.maxZ, area.floorY].map(value => value.toFixed(6)).join(":");
  assert.deepEqual(mirroredFloors.map(floorKey).sort(), normalFloors.map((area) => floorKey({
    ...area,
    minX: area.minX + 8,
    maxX: area.maxX + 8,
  })).sort());
});

it("loads the explicit three-room castle with an open rear tower and terrace entrance", async () => {
  const map = JSON.parse(await readFile(new URL("../../../../../src/game/maps/tests/castle-rear-bell-tower.json", import.meta.url), "utf8"));
  const castle = map.objects.find((object) => object.object === "Castle");
  const plan = await CastleGenerator.generate(castle);
  for (const fixture of plan.metadata.runtime.authoredObjects) {
    const sample = map.objects.find(item => item.id === fixture.id);
    assert.ok(Math.abs(fixture.position.x - sample.position.x) < 1e-6, `${fixture.id}: saved and generated X agree`);
    assert.ok(Math.abs(fixture.position.z - sample.position.z) < 1e-6, `${fixture.id}: saved and generated Z agree`);
  }
  assert.equal(plan.layout.basePlanId, "castle-rear-bell-tower");
  assert.deepEqual(plan.metadata.runtime.residential.placedRooms.map((room) => room.id), ["throne-hall", "service-quarters", "storeroom"]);
  assert.ok(plan.metadata.runtime.residential.placedRooms.every((room) => room.floorY === 2));
  assert.equal(plan.geometry.decorations.roofs.length, 0);
  const doors = plan.metadata.runtime.roomDoors;
  assert.deepEqual(doors.map((door) => door.roomId), ["service-quarters", "storeroom", "service-passage", "tower-ground", "tower-terrace"]);
  assert.deepEqual(doors.map((door) => door.y), [2, 2, 2, 2, 6]);
  assert.deepEqual(doors.map((door) => door.openWide), [true, true, true, false, false]);
  assert.deepEqual(doors.slice(0, 2).map((door) => door.frameClearance), [.15, .15]);
  assert.ok(doors.every((door) => Math.abs(door.width - 1.2) < 1e-6 && Math.abs(door.height - 2.4) < 1e-6));
  assert.deepEqual(doors.map((door) => Math.round(door.z * 1000) / 1000), [.75, 3.5, 4, -3.125, -3.125]);
  assert.equal(castle.position.depth, 14);
  const entranceX = castle.position.x + castle.doors[0].offset + castle.doors[0].width / 2;
  const pathColumns = map.grid[28].flatMap((tile, column) => tile === 2 ? [column] : []);
  assert.equal(entranceX, pathColumns.reduce((sum, column) => sum + column - (map.cols - 1) / 2, 0) / pathColumns.length);
  for (const side of [-1, 1]) {
    assert.ok(plan.metadata.collision.cameraBlocks.some(b => Math.abs(b.x - side * 1.375) < b.halfX &&
      Math.abs(b.z + .5) < b.halfZ && Math.abs(b.y - 4) < b.halfY),
    "Both sides widen equally at the corridor junction");
    assert.equal(plan.metadata.collision.cameraBlocks.some(b => Math.abs(b.x - side * 1.1) < b.halfX &&
      Math.abs(b.z + .5) < b.halfZ && Math.abs(b.y - 4) < b.halfY), false,
    "The corridor has the same clear width on each side");
  }
  for (const side of [-1, 1]) {
    assert.equal(plan.metadata.collision.cameraBlocks.some(b => Math.abs(b.x - side * 1.05) < b.halfX &&
      Math.abs(b.z + .85) < b.halfZ && Math.abs(b.y - 6.5) < b.halfY), false,
    "Terrace link wall ends flush without a projecting end cap");
  }
  for (const side of [-1, 1]) {
    for (const z of [-2.5, -2, -1.5]) {
      assert.ok(plan.metadata.collision.cameraBlocks.some(b => Math.abs(b.x - side * 1.05) < b.halfX &&
        Math.abs(b.z - z) < b.halfZ && Math.abs(b.y - 6.4) < b.halfY), "Terrace link side parapet is continuous");
    }
  }
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const a = degrees * Math.PI / 180;
    assert.ok(plan.metadata.collision.cameraBlocks.some(b => Math.abs(b.x - Math.sin(a) * 3.1) <= b.halfX &&
      Math.abs(b.z - (-6.25 + Math.cos(a) * 3.1)) <= b.halfZ && Math.abs(b.y - 10.5) < b.halfY),
    `Protective belfry wall at ${degrees} degrees`);
  }
  const floorAreas = plan.metadata.runtime.residential.walkableAreas;
  const residential = plan.metadata.runtime.residential;
  const bedsideLanterns = residential.furniture.filter(item => item.object === "Lantern" && item.supportId);
  assert.ok(bedsideLanterns.length > 0);
  assert.ok(bedsideLanterns.every(item => item.properties.type === "table"), "Bedside lanterns use the freestanding model");
  const servicePassage = residential.spaces.find((space) => space.id === "service-passage");
  assert.equal(servicePassage.kind, "corridor");
  assert.equal(servicePassage.floorFinish, "wood");
  assert.equal(servicePassage.maxX - servicePassage.minX, 3);
  const passageDoor = doors.find((door) => door.roomId === "service-passage");
  assert.ok(Math.abs(passageDoor.x + 1.5) < 1e-6);
  assert.equal(passageDoor.z, 4);
  for (const z of [0, 1, 2, 3, 5]) {
    assert.ok(plan.geometry.boxes.some((box) => Math.abs(box.x + 1.5) <= box.sx / 2 + 1e-6 &&
      Math.abs(box.z - z) <= box.sz / 2 + 1e-6 && Math.abs(box.y - 3) <= box.sy / 2 + 1e-6),
    `The partition screens the side rooms at z=${z}`);
  }
  const finish = CastleFloorFinish.bounds(residential.rooms.work, residential.buildings, residential.openings);
  assert.equal(finish.minZ, residential.buildings[0].minZ, "Timber reaches the inside entrance wall without a bare stone strip");
  const corridor = residential.spaces.find((space) => space.id === "rear-corridor");
  assert.ok(Math.abs(corridor.maxX - corridor.minX - 1.4) < 1e-6, "The tower passage has the requested narrower clearance");
  assert.equal(residential.buildings.length, 1, "The passage has no overlapping second envelope");
  for (const x of [-.75, -.5, 0, .5, .75]) {
    for (const z of [-2.875, -2.25, -1.5, -1.125]) {
      assert.ok(plan.geometry.boxes.some((box) => Math.abs(box.x - x) <= box.sx / 2 + 1e-6 &&
        Math.abs(box.z - z) <= box.sz / 2 + 1e-6 && Math.abs(box.y - 5.9) < box.sy / 2),
      `Passage ceiling has no daylight hole at ${x}, ${z}`);
    }
  }
  assert.equal(map.objects.find((object) => object.id === "store-lantern").position.y, 3.5);
  const bellFloor = residential.walkableAreas.filter((area) => area.floorY === 10.02);
  assert.ok(bellFloor.length > 0, "The bell platform is registered as a walking surface");
  for (const x of [-6, -5.75, -5.5, -5.25, -5]) {
    assert.ok(bellFloor.some((area) => area.minX <= x && area.maxX >= x && area.minZ <= 11 && area.maxZ >= 11),
      `Continuous radial bell approach at local x=${x}`);
  }
  for (const room of plan.metadata.runtime.residential.placedRooms) {
    for (let x = room.minX + .125; x < room.maxX; x += .25) {
      for (let z = room.minZ + .125; z < room.maxZ; z += .25) {
        assert.ok(floorAreas.some((area) => area.floorY === room.floorY &&
          x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ),
        `Continuous floor in ${room.id} at ${x}, ${z}`);
      }
    }
  }
  const furniture = plan.metadata.runtime.residential.furniture;
  assert.ok(furniture.some((item) => item.object === "ThroneDais"));
  assert.ok(furniture.some((item) => item.role === "servantBed"));
  assert.equal(plan.metadata.runtime.residential.rooms.work.maxX - plan.metadata.runtime.residential.rooms.work.minX, 6);
  assert.equal(map.objects.filter((item) => item.object === "Shelf" && item.variant === "storage").length, 2);
  assert.ok(map.objects.some((item) => item.object === "Throne"));
  assert.ok(map.objects.filter((item) => item.object === "Shelf" && item.variant === "storage").every((item) => item.items.length >= 4));
  assert.ok(plan.geometry.boxes.some((box) => box.material === "castleTowerBlue"));
  const stairs = map.objects.filter((object) => object.object === "SpiralStaircase");
  assert.equal(stairs.length, 2);
  assert.ok(stairs.every((stair) => stair.doorFacingEntry === undefined), "Use only the original spiral treads");
  assert.deepEqual(stairs.map((stair) => stair.rotation), [90, 90],
    "The unmodified spiral starts on the right, facing back toward the entrance");
  assert.ok(stairs.every((stair) => stair.stepProfile === "castle"), "Use the 20 cm riser profile inside the 2.75 m clear tower bore");
  for (const box of plan.geometry.boxes) {
    const intersectsStairHeight = [3, 7].some((height) => Math.abs(box.y - height) < box.sy / 2);
    if (!intersectsStairHeight) {
      continue;
    }
    const nearestRadius = Math.hypot(Math.max(0, Math.abs(box.x) - box.sx / 2),
      Math.max(0, Math.abs(box.z + 6.25) - box.sz / 2));
    if (nearestRadius < 3.25) {
      assert.ok(nearestRadius >= 2.75 - 1e-6, "Tower masonry stays outside the full circular stair and rail clearance");
    }
  }
  assert.equal(stairs[0].Z1, 2);
  assert.equal(stairs[0].Z2, stairs[1].Z1);
  assert.equal(stairs[1].Z2, 10);
  assert.equal(stairs[1].columnTop, 9.98);
  assert.equal(stairs[1].exitFloorOwned, false);
  for (let degrees = 30; degrees <= 330; degrees += 15) {
    const angle = degrees * Math.PI / 180;
    const x = Math.sin(angle) * 3;
    const z = -6.25 + Math.cos(angle) * 3;
    assert.ok(plan.geometry.boxes.some((box) => Math.abs(box.x - x) <= box.sx / 2 + 1e-6 &&
      Math.abs(box.z - z) <= box.sz / 2 + 1e-6 && Math.abs(box.y - 3) <= box.sy / 2 + 1e-6),
    `The enlarged tower shell has no missing masonry at ${degrees} degrees`);
  }
  const terraceFloor = residential.walkableAreas.filter((area) => area.floorY === 6.02);
  for (const worldX of [-0.25, 0, 0.25]) {
    for (const worldZ of [-3.5, -4, -4.5, -5, -5.5]) {
      const x = -4 - worldX;
      const z = 5 - worldZ;
      assert.ok(terraceFloor.some((area) => x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ),
        `A level landing fills the gap directly before the terrace door at ${worldX}, ${worldZ}`);
    }
  }
  for (let degrees = 0; degrees <= 90; degrees += 15) {
    const angle = degrees * Math.PI / 180;
    const x = -4 - Math.sin(angle) * 2.25;
    const z = 11.25 - Math.cos(angle) * 2.25;
    assert.ok(terraceFloor.some((area) => x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ),
      `The terrace door has a continuous perimeter route to the right-hand stair at ${degrees} degrees`);
  }
  assert.equal(map.objects.find((object) => object.object === "SignalBell").position.y, 10.02);
  assert.equal(map.objects.find((object) => object.object === "SignalBell").variant, "ceiling");
  assert.equal(bellFloor.some(area => area.minX < -4 && area.maxX > -4.5 && area.minZ < 11.5 && area.maxZ > 11.4), false,
    "No former bell-frame pad behind the central landing");
  assert.equal(map.objects.find((object) => object.object === "SignalBell").position.z, stairs[1].position.z);
  for (const degrees of [135, 180, 225, 270, 315]) {
    const angle = degrees * Math.PI / 180;
    const x = Math.sin(angle) * 1.3;
    const z = stairs[1].position.z + Math.cos(angle) * 1.3;
    assert.equal(plan.geometry.boxes.some((box) =>
      Math.abs(box.x - x) < box.sx / 2 && Math.abs(box.z - z) < box.sz / 2 &&
      Math.abs(box.y - 9.875) < box.sy / 2), false, `Stair headroom below bell landing at ${degrees} degrees`);
  }
  for (const point of [{
    x: 0,
    y: 5.5,
    z: -.9,
  }, {
    x: .95,
    y: 3,
    z: -.8,
  }, {
    x: -.95,
    y: 3,
    z: -.8,
  }, {
    x: 0,
    y: 3,
    z: -3.25,
  }, {
    x: 0,
    y: 7,
    z: -3.25,
  }, {
    x: 0,
    y: 6.5,
    z: -1,
  }]) {
    const blocksPoint = (box) => Math.abs(box.x - point.x) < box.sx / 2 - 1e-6 &&
      Math.abs(box.y - point.y) < box.sy / 2 - 1e-6 && Math.abs(box.z - point.z) < box.sz / 2 - 1e-6;
    assert.equal(plan.geometry.boxes.some(blocksPoint), false, `Open circulation at ${JSON.stringify(point)}`);
  }
});


it("fits partial landing bricks to the diagonal arrival edge without closing the stairwell", async () => {
  const { CastleRoundTower } = await import("../../../../../src/game/generator/castle/CastleRoundTower.js");
  const boxes = [];
  CastleRoundTower.emit({
    center: [0, 0],
    radius: 3.25,
    wallThickness: .5,
    height: 8,
    terraceElevation: 4,
    doorWidth: 1.2,
    doorHeight: 2.4,
    belfryHeight: 2.5,
    roofHeight: 1.5,
  }, 2,
  (box) => {
    if (box.maxY === 6.02) {
      boxes.push(box);
    }
  });
  const covered = (x, z) => boxes.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
  for (let z = .15; z < 1.5; z += .07) {
    assert.ok(covered(-z / Math.sqrt(3) + .01, z), `missing cut brick at ${z}`);
    assert.equal(covered(-z / Math.sqrt(3) - .03, z), false, `brick protrudes into arrival at ${z}`);
  }
  for (let angle = 100; angle < 320; angle += 7) {
    const a = angle * Math.PI / 180;
    assert.ok(covered(Math.sin(a) * 1.79, Math.cos(a) * 1.79), `missing bore edge at ${angle}`);
    assert.equal(covered(Math.sin(a) * 1.7, Math.cos(a) * 1.7), false);
  }
});

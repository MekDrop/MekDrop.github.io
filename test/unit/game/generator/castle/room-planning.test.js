import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { StairwellRoomGenerator } from "../../../../../src/game/generator/castle/rooms/StairwellRoomGenerator.js";
import { CastleRoomPacker } from "../../../../../src/game/generator/castle/CastleRoomPacker.js";
import { CastleGenerationContext } from "../../../../../src/game/generator/castle/CastleGenerationContext.js";
import { LayoutStyleStage } from "../../../../../src/game/generator/castle/stages/LayoutStyleStage.js";
import { RoomPlanningStage } from "../../../../../src/game/generator/castle/stages/RoomPlanningStage.js";
import { RoomFurnishingStage } from "../../../../../src/game/generator/castle/stages/RoomFurnishingStage.js";
import { AbstractCastleRoomGenerator } from "../../../../../src/game/generator/castle/rooms/AbstractCastleRoomGenerator.js";
import { CastleRoomSizeInvalidError } from "../../../../../src/game/errors/castle/index.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { createCastleGroundCuts } from "../../../../../src/game/objects/castle/CastleGroundCuts.js";

const options = { position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
  doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" };
import { ThroneRoomGenerator } from "../../../../../src/game/generator/castle/rooms/ThroneRoomGenerator.js";
import { LibraryRoomGenerator } from "../../../../../src/game/generator/castle/rooms/LibraryRoomGenerator.js";
import { ServiceRoomGenerator } from "../../../../../src/game/generator/castle/rooms/ServiceRoomGenerator.js";
import { LeisureRoomGenerator } from "../../../../../src/game/generator/castle/rooms/LeisureRoomGenerator.js";
import { TowerRoomGenerator } from "../../../../../src/game/generator/castle/rooms/TowerRoomGenerator.js";
class UpstairsLeisureGenerator extends LeisureRoomGenerator {
  get levels() { return [1]; }
}
const basementOptions = () => {
  const service = new ServiceRoomGenerator();
  service.min = { x: 2, y: 7 };
  return { ...options, roomGenerators: [new ThroneRoomGenerator(), new LibraryRoomGenerator(), service,
    new UpstairsLeisureGenerator(), ...[1, 2, 3, 4].map((index) => new TowerRoomGenerator(index))] };
};
const order = ["throneRoom", "library", "service", "leisure", "tower1", "tower2", "tower3", "tower4"];

it("uses the full reserved castle footprint and ordered, separated rooms for every orientation", async () => {
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ ...options, style, doors: [{ side, offset: 3, width: 2 }] });
      assert.equal(plan.layout.castleDepth, 32);
      const layout = new CastleResidentialLayout(plan);
      const entrances = plan.layout.roomPlan.doorways.filter((doorway) =>
        (doorway.roomId !== "leisure" && doorway.floorY > layout.origin.y) ||
        (["library", "service"].includes(doorway.roomId) && doorway.floorY <= layout.origin.y));
      assert.equal(plan.metadata.runtime.roomDoors.length, entrances.length);
      assert.ok(plan.metadata.runtime.roomDoors.some((door) => door.roomId === plan.layout.roomPlan.stairHostRoomId &&
        door.y > layout.origin.y && door.height === 2 && door.openingInset === 0), "the covered stair room has a rectangular upper entrance door");
      assert.ok(entrances.length < plan.layout.roomPlan.doorways.length);
      assert.ok(!plan.metadata.runtime.roomDoors.some((door) => door.roomId === "throneRoom"),
        "the main gate serves the hall; its circulation passages remain open");
      assert.equal(plan.metadata.runtime.roomDoors.filter((door) =>
        door.roomId === "library" && door.y === layout.origin.y).length, 2,
      "both private library entrances have doors");
      for (const [index, doorway] of entrances.entries()) {
        const expected = layout.toWorld(doorway.axis === "x" ? doorway.coordinate : doorway.center,
          doorway.axis === "z" ? doorway.coordinate : doorway.center, doorway.floorY - layout.origin.y);
        const door = plan.metadata.runtime.roomDoors[index];
        assert.ok(Math.abs(door.x - expected.x) < 1e-6 && Math.abs(door.z - expected.z) < 1e-6);
        assert.equal(door.y, expected.y);
        assert.equal(door.width, doorway.width);
        assert.equal(door.height, 2);
        if (door.roomId === plan.layout.roomPlan.stairHostRoomId && door.y > layout.origin.y) {
          const shaft = plan.layout.roomPlan.shaft;
          assert.ok(doorway.center - doorway.width / 2 >= shaft.minZ + 0.249 ||
            doorway.center + doorway.width / 2 <= shaft.maxZ - 0.249, "upper door retains a masonry corner jamb");
        }
      }
      const { placedRooms, roomRequirements, skippedRooms } = plan.layout.roomPlan;
      assert.deepEqual(placedRooms.map((room) => room.id), order.filter((id) => !skippedRooms.includes(id)));
      for (const room of placedRooms) {
        const required = roomRequirements.find((entry) => entry.id === room.id);
        assert.ok(room.maxX - room.minX >= required.min.x);
        assert.ok(room.maxZ - room.minZ >= required.min.y);
        assert.ok(room.maxX - room.minX <= required.max.x);
        assert.ok(room.maxZ - room.minZ <= required.max.y);
        for (const other of placedRooms) {
          if (other !== room && other.level === room.level) {
            assert.equal(CastleRoomPacker.overlaps(room, other, 0.25), false);
          }
        }
      }
    }
  }
});

it("moves service rooms to a connected basement and other overflow upstairs", async () => {
  const plan = await CastleGenerator.generate(basementOptions());
  const residential = plan.layout.roomPlan;
  assert.equal(residential.rooms.service.level, -1);
  const overflow = await CastleGenerator.generate(options);
  assert.equal(overflow.layout.roomPlan.rooms.leisure.level, 1);
  const lower = overflow.layout.roomPlan.rooms.throneRoom;
  const upper = overflow.layout.roomPlan.rooms.leisure;
  assert.ok(upper.minX >= lower.minX && upper.maxX <= lower.maxX, "upstairs walls stay above their supporting room");
  assert.equal(upper.minZ, lower.minZ);
  assert.ok(upper.maxX <= lower.maxX && upper.maxZ <= lower.maxZ);
  assert.ok(residential.stair);
  assert.ok(residential.serviceStair);
  assert.ok(residential.basement);
  const spacious = await CastleGenerator.generate({ ...options,
    position: { ...options.position, width: 12, depth: 12 }, doors: [{ side: "NORTH", offset: 5, width: 2 }] });
  assert.equal(spacious.layout.roomPlan.rooms.service.level, 0);
  assert.equal(spacious.layout.roomPlan.basement, null);
  assert.equal(spacious.layout.roomPlan.serviceStair, null);
});

it("towers start at ground corners and never occupy an upstairs room footprint", async () => {
  for (let seed = 0; seed < 12; seed++) {
    const plan = await CastleGenerator.generate({ ...options, seed });
    const { placedRooms, outerBounds } = plan.layout.roomPlan;
    for (const tower of placedRooms.filter((room) => room.id.startsWith("tower"))) {
      assert.equal(tower.level, 0);
      assert.equal(tower.floorSpan, 2);
      assert.ok(tower.minX === outerBounds.minX || tower.maxX === outerBounds.maxX);
      assert.ok(tower.minZ === outerBounds.minZ || tower.maxZ === outerBounds.maxZ);
      for (const room of placedRooms) {
        if (room === tower || room.level < 0) { continue; }
        assert.equal(CastleRoomPacker.overlaps(tower, room), false);
      }
    }
    assert.equal(plan.structure.towers.length, placedRooms.filter((room) => room.id.startsWith("tower")).length);
    if (placedRooms.some((room) => room.level + room.floorSpan > 1)) { assert.ok(plan.layout.roomPlan.stair); }
  }
});

it("allows a ground-based tower above a basement room", async () => {
  const custom = basementOptions();
  custom.roomGenerators[2].min = { x: 2, y: 11 };
  custom.roomGenerators[2].max = undefined;
  custom.roomGenerators = custom.roomGenerators.filter((generator) => generator.id !== "leisure");
  const plan = await CastleGenerator.generate({ ...custom, position: { ...options.position, width: 12, depth: 12 }, doors: [{ side: "NORTH", offset: 5, width: 2 }], seed: "default" });
  const tower = plan.layout.roomPlan.placedRooms.find((room) => room.id.startsWith("tower") && CastleRoomPacker.overlaps(room, plan.layout.roomPlan.rooms.service));
  const service = plan.layout.roomPlan.rooms.service;
  assert.equal(service.level, -1);
  assert.equal(tower.level, 0);
  assert.ok(CastleRoomPacker.overlaps(tower, service), "basement overlap does not exclude the tower");
});

it("plans stairs as subrooms with height and two placed room endpoints", async () => {
  const plan = await CastleGenerator.generate(basementOptions());
  const { placedRooms, subrooms, shaft } = plan.layout.roomPlan;
  assert.equal(subrooms.length, 2);
  const host = placedRooms.find((room) => room.id === plan.layout.roomPlan.stairHostRoomId);
  assert.ok(host && host.id === "library");
  assert.ok(host.minX <= shaft.minX && host.maxX >= shaft.maxX);
  assert.ok(host.minZ <= shaft.minZ && host.maxZ >= shaft.maxZ);
  assert.equal(placedRooms.some((room) => room.id.includes("Stair")), false);
  for (const stair of subrooms) {
    assert.ok(placedRooms.some((room) => room.id === stair.fromRoomId));
    assert.ok(placedRooms.some((room) => room.id === stair.toRoomId));
    assert.ok(stair.fromLevel < stair.toLevel);
    assert.ok(stair.height > 0);
    assert.equal(stair.ceilingY, stair.floorY + stair.height + 2.25);
  }
  const generator = new StairwellRoomGenerator("testStair");
  assert.equal(generator.connect(placedRooms[0], null, shaft), null);
  assert.equal(generator.connect(null, placedRooms[0], shaft), null);
  assert.equal(generator.connect(placedRooms[0], placedRooms[0], shaft), null);
});

it("uses seeded random sizes with stable output for repeated seeds", async () => {
  const a = await CastleGenerator.generate({ ...options, seed: "a" });
  const b = await CastleGenerator.generate({ ...options, seed: "b" });
  assert.deepEqual(await CastleGenerator.generate({ ...options, seed: "a" }), a);
  assert.notDeepEqual(a.layout.roomPlan.placedRooms, b.layout.roomPlan.placedRooms);
});

class UnboundedRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("unbounded", { x: 1, y: 1 }); }
}

it("requires minimum dimensions and treats an omitted maximum as unbounded", () => {
  class InvalidRoomGenerator extends AbstractCastleRoomGenerator {
    constructor(min, max) { super("invalid", min, max); }
  }
  assert.throws(() => new InvalidRoomGenerator(), CastleRoomSizeInvalidError);
  assert.throws(() => new InvalidRoomGenerator({ x: 0, y: 1 }), CastleRoomSizeInvalidError);
  assert.throws(() => new InvalidRoomGenerator({ x: 2, y: 2 }, { x: 1, y: 1 }), CastleRoomSizeInvalidError);
  const generator = new UnboundedRoomGenerator();
  assert.equal(generator.max, undefined);
  const packer = new CastleRoomPacker({ minX: -5.5, maxX: 5.5, minZ: 0.5, maxZ: 11.5 }, 3, 3, "unbounded");
  packer.place([generator]);
  assert.equal(packer.rooms.length, 1);
  assert.ok(packer.rooms[0].maxX - packer.rooms[0].minX >= 1);
  assert.ok(packer.rooms[0].maxZ - packer.rooms[0].minZ >= 1);
});

it("furnishes only after every room's area has been placed", async () => {
  const scheduler = { now: () => 0, yieldIfNeeded: async () => {} };
  const context = new CastleGenerationContext(options, scheduler);
  await new LayoutStyleStage().run(context);
  await new RoomPlanningStage().run(context);
  const plan = context.layout.roomPlan;
  assert.equal(plan.furniture, undefined);
  const bounds = structuredClone(plan.placedRooms);
  await new RoomFurnishingStage().run(context);
  assert.deepEqual(plan.placedRooms, bounds);
  assert.ok(plan.furniture.length > 0);
  for (const item of plan.furniture) {
    const room = plan.placedRooms.find((candidate) => candidate.id === item.roomId);
    assert.equal(item.floorY, room.floorY);
    assert.ok(item.x - item.width * item.scale / 2 >= room.minX);
    assert.ok(item.x + item.width * item.scale / 2 <= room.maxX);
    assert.ok(item.z - item.depth * item.scale / 2 >= room.minZ);
    assert.ok(item.z + item.depth * item.scale / 2 <= room.maxZ);
  }
});

it("skips rooms whose minimum cannot fit on either permitted floor", () => {
  class HugeRoomGenerator extends AbstractCastleRoomGenerator {
    constructor() { super("huge", { x: 20, y: 20 }); }
  }
  const packer = new CastleRoomPacker({ minX: -3.5, maxX: 3.5, minZ: 0.5, maxZ: 7.5 }, 3, 3, "skip");
  packer.place([new HugeRoomGenerator()]);
  assert.deepEqual(packer.rooms, []);
  assert.deepEqual(packer.skipped, ["huge"]);
});

it("encloses covered rooms and leaves the leisure terrace open to the sky", async () => {
  const plan = await CastleGenerator.generate(options);
  const layout = new CastleResidentialLayout(plan);
  const solidAt = (x, z, y) => {
    const point = layout.toWorld(x, z, y - layout.origin.y);
    return plan.metadata.collision.cameraBlocks.some((block) => Math.abs(block.x - point.x) < block.halfX + 1e-6 &&
      Math.abs(block.z - point.z) < block.halfZ + 1e-6 && Math.abs(block.y - point.y) < block.halfY + 1e-6);
  };
  const host = plan.layout.roomPlan.placedRooms.find((room) => room.stairHost);
  const shaft = plan.layout.roomPlan.shaft;
  assert.ok(solidAt((shaft.minX + shaft.maxX) / 2, (shaft.minZ + shaft.maxZ) / 2,
    host.floorY + host.height + 0.125), "stair opening does not puncture the final roof");
  assert.ok(plan.geometry.decorations.roofs.some((roof) => roof.y >= host.floorY + host.height),
    "an inaccessible ceiling has a pitched roof");
  const throne = plan.layout.roomPlan.rooms.throneRoom;
  assert.ok(solidAt(0.125, throne.maxZ + 0.125, throne.floorY + 0.875), "no passage behind the royal");
  assert.equal(plan.layout.roomPlan.reservations.throne.maxZ, throne.maxZ);
  for (const room of plan.layout.roomPlan.placedRooms) {
    const x = (room.minX + room.maxX) / 2;
    const z = room.stairHost ? room.minZ + 0.25 : (room.minZ + room.maxZ) / 2;
    assert.equal(solidAt(x, z, room.floorY + 2.375 + (room.floorSpan - 1) * plan.layout.roomPlan.rise), room.id !== "leisure", `${room.id} ceiling`);
    assert.ok(solidAt(x, room.minZ - 0.125, room.floorY + (room.id === "leisure" ? 0.875 : 2.125)), `${room.id} wall/lintel`);
    const entry = plan.layout.roomPlan.doorways.find((entry) => entry.roomId === room.id && entry.floorY === room.floorY);
    const doorway = entry.axis === "x" ? [entry.coordinate, entry.center] : [entry.center, entry.coordinate];
    assert.equal(solidAt(...doorway, room.floorY + 0.875), false, `${room.id} doorway`);
  }
});

it("keeps stair shafts clear, supports their exits, and samples the correct upper tread", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ ...options, doors: [{ side, offset: 3, width: 2 }] });
    const layout = new CastleResidentialLayout(plan);
    const local = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
    let elevation = layout.origin.y;
    for (const tread of layout.stairs.treads) {
      assert.equal(layout.stairSurfaceHeightAt(tread.x, tread.z, elevation), tread.y);
      elevation = tread.y;
    }
    for (const block of plan.metadata.collision.cameraBlocks) {
      if (block.y + block.halfY <= layout.origin.y || block.y - block.halfY >= elevation + 2) { continue; }
      const p = layout.toLocal(block.x, block.z);
      const distance = Math.hypot(Math.max(0, Math.abs(p.x - local.x) - block.halfX),
        Math.max(0, Math.abs(p.z - local.z) - block.halfZ));
      assert.ok(distance >= layout.stairs.radius - 1e-6, "shaft has no masonry");
    }
    const landing = layout.walkableAreas.find((area) => area.id === "mainStairLanding");
    const exit = layout.toWorld((landing.minX + landing.maxX) / 2, (landing.minZ + landing.maxZ) / 2, landing.floorY - layout.origin.y);
    assert.equal(layout.surfaceHeightAt(exit.x, exit.z, exit.y), exit.y);
    assert.equal(layout.surfaceHeightAt(layout.stairs.center.x, layout.stairs.center.z, elevation), null);
  }
});

it("excavates a rotated basement within the footprint with a sealed soil ceiling", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ ...basementOptions(), doors: [{ side, offset: 3, width: 2 }] });
    const cuts = createCastleGroundCuts(plan, new CastleResidentialLayout(plan));
    assert.ok(cuts.every((cut) => Object.values(cut).every(Number.isFinite)));
    const basement = cuts.find((cut) => cut.minY === 0.5 && cut.maxY === 2.75);
    assert.ok(basement);
    assert.ok(basement.minX >= -4 && basement.maxX <= 4);
    assert.ok(basement.minZ >= -4 && basement.maxZ <= 4);
  }
});

it("generates the reported map seed with a full-size castle", async () => {
  const { MapGenerator } = await import("../../../../../src/game/generator/map/MapGenerator.js");
  const map = await MapGenerator.generate({ mapName: "muipi14f_1kk6rt6" });
  assert.equal(map.castle.position.width, 8);
  assert.equal(map.castle.position.depth, 8);
  assert.ok(map.objects.length > 0);
});

it("connects basement tread heights to the ground-floor stair landing", async () => {
  const plan = await CastleGenerator.generate(basementOptions());
  const layout = new CastleResidentialLayout(plan);
  const servant = {};
  layout.servant = servant;
  const stair = layout.serviceStair;
  let elevation = stair.center.y;
  for (let step = 1; step <= 24; step++) {
    const angle = Math.PI / 2 - stair.yaw * Math.PI / 180 - (step - 0.5) / 24 * 1.5 * Math.PI * 2;
    const x = stair.center.x + Math.cos(angle) * stair.radius * 0.335 / 0.65;
    const z = stair.center.z + Math.sin(angle) * stair.radius * 0.335 / 0.65;
    const y = stair.center.y + stair.rise * step / 24;
    assert.equal(layout.stairSurfaceHeightAt(x, z, elevation, servant), y);
    elevation = y;
  }
  assert.equal(elevation, layout.origin.y);
});

it("connects tower entrances on both occupied floors", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ ...options, doors: [{ side, offset: 3, width: 2 }] });
    const layout = new CastleResidentialLayout(plan);
    for (const tower of plan.layout.roomPlan.placedRooms.filter((room) => room.id.startsWith("tower"))) {
      const doorX = (tower.minX + tower.maxX) / 2 < 0 ? tower.maxX + 0.125 : tower.minX - 0.125;
      const doorZ = (tower.minZ + tower.maxZ) / 2;
      const upper = layout.toWorld(doorX, doorZ, plan.layout.roomPlan.rise + 0.875);
      const ground = layout.toWorld(doorX, doorZ, 0.875);
      const solidAt = (point) => plan.metadata.collision.cameraBlocks.some((block) =>
        Math.abs(block.x - point.x) <= block.halfX + 1e-6 &&
        Math.abs(block.z - point.z) <= block.halfZ + 1e-6 &&
        Math.abs(block.y - point.y) <= block.halfY + 1e-6);
      assert.equal(solidAt(upper), false, `${side} tower connects to the upper route`);
      assert.equal(solidAt(ground), false, `${side} tower retains its ground entrance`);
    }
  }
});


it("rearranges rooms before accepting a skipped tower and preserves deterministic placement", async () => {
  const settings = { ...options, seed: 0, position: { ...options.position, x: -6, z: -6, width: 12, depth: 12 },
    doors: [{ side: "NORTH", offset: 5, width: 2 }] };
  const first = await CastleGenerator.generate(settings);
  const second = await CastleGenerator.generate(settings);
  const plan = first.layout.roomPlan;
  const generators = [new ThroneRoomGenerator(), new LibraryRoomGenerator(), new ServiceRoomGenerator(),
    new LeisureRoomGenerator({ courtyard: true }), ...[1, 2, 3, 4].map((index) => new TowerRoomGenerator(index))];
  const firstFit = new CastleRoomPacker(plan.outerBounds, settings.position.elevation, plan.rise, "0:arrangement:0");
  firstFit.place(generators);
  assert.ok(plan.placedRooms.length > firstFit.rooms.length, "reconsidering earlier placements fits an additional room");
  assert.deepEqual(plan.placedRooms, second.layout.roomPlan.placedRooms);
  assert.equal(first.input.position.width, 12);
  assert.equal(first.input.position.depth, 12);
});

it("closes private room entrances at their masonry plane and carries partitions to the ceiling", async () => {
  const generated = await CastleGenerator.generate(options);
  const plan = generated.layout.roomPlan;
  const layout = new CastleResidentialLayout(generated);
  for (const opening of plan.doorways.filter((entry) => ["library", "service"].includes(entry.roomId))) {
    const position = layout.toWorld(opening.axis === "x" ? opening.coordinate : opening.center,
      opening.axis === "z" ? opening.coordinate : opening.center, opening.floorY - plan.origin.y);
    const door = generated.metadata.runtime.roomDoors.find((entry) => entry.roomId === opening.roomId &&
      Math.abs(entry.x - position.x) < 1e-6 && Math.abs(entry.z - position.z) < 1e-6 && entry.y === opening.floorY);
    assert.ok(door, "every private entrance receives a door");
    assert.equal(door.openingInset, 0);
    assert.equal(door.width * 4, Math.round(door.width * 4));
  }
  for (const room of plan.placedRooms.filter((entry) => entry.level === 0 && entry.floorSpan === 1 && entry.id !== "leisure")) {
    assert.ok(generated.metadata.collision.cameraBlocks.some((block) => {
      const point = layout.toLocal(block.x, block.z);
      return Math.abs(point.z - room.maxZ - 0.125) < 0.13 && point.x > room.minX && point.x < room.maxX &&
        block.y > room.floorY + plan.rise - 0.25 && block.y < room.floorY + plan.rise;
    }), `${room.id} has masonry reaching the ceiling underside`);
  }
});

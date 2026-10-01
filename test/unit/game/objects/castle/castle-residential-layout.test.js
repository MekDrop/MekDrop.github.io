import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleResidentialLayout, createCastleButtressFootings } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

const makePlan = (side = "NORTH", towerSpanBlocks = 8, wallHeightBlocks = 11) => ({
  input: { position: { x: 10, z: 20, width: 8, depth: 8, elevation: 3 }, doors: [{ side, offset: 3, width: 2 }] },
  layout: { baseY: 3, castleDepth: 20, style: { towerSpanBlocks, wallHeightBlocks } },
  metadata: { runtime: { interiorWidth: 6, audienceOpening: { start: 12, end: 20 } } },
});

it("keeps two occupied floors and basement distinct with an empty balcony", () => {
  const layout = new CastleResidentialLayout(makePlan());
  assert.equal(layout.rooms.work.floorY, 3);
  assert.equal(layout.rooms.bedroom.floorY, 6);
  assert.equal(layout.rooms.balcony.floorY, 6);
  assert.equal(layout.basement.floorY, 0.5);
  assert.equal(layout.rooms.servantBedroom.floorY, layout.basement.floorY);
  assert.equal(layout.placements.filter((item) => item.role.toLowerCase().includes("desk")).length, 1);
  assert.ok(layout.placements.every((item) => {
    const local = layout.toLocal(item.position.x, item.position.z);
    const balcony = layout.rooms.balcony;
    return item.position.y !== balcony.floorY || local.z < balcony.minZ;
  }));
});

it("transforms all entrance orientations with local +Z inward", () => {
  for (const [side, expected] of Object.entries({ NORTH: [14, 22], SOUTH: [14, 26], WEST: [12, 24], EAST: [16, 24] })) {
    const layout = new CastleResidentialLayout(makePlan(side));
    assert.ok(layout.exteriorWindows.every((window) => Object.values(window.position).every(Number.isFinite)));
    const world = layout.toWorld(0, 2, 0);
    assert.ok(Math.abs(world.x - expected[0]) < 1e-8);
    assert.ok(Math.abs(world.z - expected[1]) < 1e-8);
    const offset = layout.toWorld(0.73, 1.28, 0);
    const local = layout.toLocal(offset.x, offset.z);
    assert.ok(Math.abs(local.x - 0.73) < 1e-8);
    assert.ok(Math.abs(local.z - 1.28) < 1e-8);
  }
});

it("permits only the attached servant object to use basement floors", () => {
  const layout = new CastleResidentialLayout(makePlan());
  const servant = { role: "servant" };
  const impostor = { role: "servant" };
  assert.equal(layout.canEnterBasement(servant), false);
  layout.servant = servant;
  assert.equal(layout.canEnterBasement(servant), true);
  assert.equal(layout.canEnterBasement(impostor), false);
  assert.equal(layout.canEnterBasement(null), false);
  const point = layout.toWorld(-1, 3.5, -2.5);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, point.y, impostor), null);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, point.y, servant), point.y);
  layout.servant = null;
  assert.equal(layout.canEnterBasement(servant), false);
});

it("samples a nearby spiral level without jumping to the overlapping top turn", () => {
  const layout = new CastleResidentialLayout(makePlan());
  const { treads } = layout.stairs;
  const bottom = treads[0];
  const top = treads.at(-1);
  assert.equal(layout.stairSurfaceHeightAt(bottom.x, bottom.z, bottom.y), bottom.y);
  assert.equal(layout.stairSurfaceHeightAt(top.x, top.z, top.y), top.y);
  assert.ok(layout.stairSurfaceHeightAt(bottom.x, bottom.z, bottom.y) < top.y - 1);
  assert.equal(layout.stairSurfaceHeightAt(bottom.x, bottom.z, undefined), null);
  assert.equal(layout.stairSurfaceHeightAt(layout.stairs.center.x, layout.stairs.center.z, bottom.y), null);
});

it("adapts upper room and stairs to procedural tower dimensions", () => {
  for (const [towerSpan, wallHeight] of [[8, 11], [9, 10], [8, 12], [6, 9]]) {
    const layout = new CastleResidentialLayout(makePlan("EAST", towerSpan, wallHeight));
    assert.equal(layout.rooms.bedroom.floorY, 3 + (wallHeight + 1) * 0.25);
    assert.ok(layout.stairs.radius <= (layout.rooms.bedroom.maxZ - layout.rooms.bedroom.minZ) / 2);
    assert.ok(layout.stairs.radius <= 0.65);
    assert.equal(layout.stairs.treads.at(-1).y, layout.rooms.bedroom.floorY);
  }
});


it("follows authored stair wedges in both directions for every entrance", () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const layout = new CastleResidentialLayout(makePlan(side));
    let elevation = layout.origin.y;
    for (const tread of layout.stairs.treads) {
      const next = layout.stairSurfaceHeightAt(tread.x, tread.z, elevation);
      assert.equal(next, tread.y);
      elevation = next;
    }
    for (const tread of [...layout.stairs.treads].reverse()) {
      const next = layout.stairSurfaceHeightAt(tread.x, tread.z, elevation);
      assert.equal(next, tread.y);
      elevation = next;
    }
  }
});

it("fits bedroom furniture without overlaps in sixteen style/orientation layouts", () => {
  const metrics = { royalBed: [1.2, 1.8], wardrobe: [0.65, 0.46], readingChair: [0.75, 0.735] };
  for (const [span, height] of [[8, 11], [9, 10], [8, 12], [8, 11]]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const layout = new CastleResidentialLayout(makePlan(side, span, height));
      const room = layout.rooms.bedroom;
      const boxes = layout.placements.filter((item) => metrics[item.role]).map((item) => {
        const local = layout.toLocal(item.position.x, item.position.z);
        const [width, depth] = metrics[item.role];
        return { minX: local.x - width * item.scale.x / 2, maxX: local.x + width * item.scale.x / 2, minZ: local.z - depth * item.scale.z / 2, maxZ: local.z + depth * item.scale.z / 2 };
      });
      for (const box of boxes) {
        assert.ok(box.minX >= room.minX && box.maxX <= room.maxX);
        assert.ok(box.minZ >= room.minZ && box.maxZ <= room.maxZ);
        const stair = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
        const dx = Math.max(box.minX - stair.x, 0, stair.x - box.maxX);
        const dz = Math.max(box.minZ - stair.z, 0, stair.z - box.maxZ);
        assert.ok(Math.hypot(dx, dz) > 0.644);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          assert.ok(a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ);
        }
      }
    }
  }
});

it("uses generated basement footprint and keeps service access clear of its walls", () => {
  const plan = makePlan();
  plan.metadata.runtime.residential = {
    basement: { x: 14.4, z: 22.5, width: 7, depth: 4, floorY: 0.5 },
    upperRoom: { x: 14, z: 20.875, width: 4, depth: 1.5 },
  };
  const layout = new CastleResidentialLayout(plan);
  const a = layout.rooms.servantBedroom;
  const b = layout.rooms.storage;
  assert.ok(Math.abs(b.maxX - a.minX - 7) < 1e-8);
  assert.equal(a.maxZ - a.minZ, 4);
  const access = layout.toLocal(layout.basement.access.x, layout.basement.access.z);
  assert.ok(b.maxX - access.x >= 0.45);
  assert.ok(access.z - b.minZ >= 0.45);
  assert.equal(layout.rooms.bedroom.minZ, 0.125);
  assert.equal(layout.rooms.bedroom.maxZ, 1.625);
  const floor = layout.basementShell.find((item) => item.role === "floor");
  assert.equal(floor.position.x, 14.4);
  assert.equal(floor.position.z, 22.5);
});

it("matches the authored stair support annulus and service stair floor heights", () => {
  const layout = new CastleResidentialLayout(makePlan());
  const { center, radius } = layout.stairs;
  assert.equal(layout.stairSurfaceHeightAt(center.x + radius, center.z, layout.origin.y), null);
  assert.equal(layout.stairSurfaceHeightAt(center.x + radius * 0.08 / 0.65 - 0.001, center.z, layout.origin.y), null);
  assert.equal(layout.serviceStair.center.y, layout.basement.floorY);
  assert.equal(layout.serviceStair.center.x, layout.basement.access.x);
  assert.equal(layout.serviceStair.center.z, layout.basement.access.z);
  assert.equal(layout.serviceStair.rise, 2.5);
  assert.equal(layout.serviceStair.radius, 0.45);
});

it("keeps the bed and service opening clear of actual generated masonry", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 }, doors: [{ side, offset: 3, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const bed = layout.placements.find((item) => item.role === "royalBed");
      const bedLocal = layout.toLocal(bed.position.x, bed.position.z);
      const stairLocal = layout.toLocal(layout.serviceStair.center.x, layout.serviceStair.center.z);
      const storage = layout.rooms.storage;
      assert.ok(Math.hypot(layout.stairs.center.x - layout.serviceStair.center.x, layout.stairs.center.z - layout.serviceStair.center.z) > layout.stairs.radius + layout.serviceStair.radius);
      assert.ok(layout.rooms.bedroom.minZ > layout.rooms.balcony.maxZ);
      for (const item of layout.placements.filter((placement) => placement.position.y === layout.rooms.bedroom.floorY)) {
        assert.ok(layout.toLocal(item.position.x, item.position.z).z > layout.rooms.balcony.maxZ);
      }
      assert.ok(stairLocal.x - layout.serviceStair.radius >= layout.rooms.servantBedroom.minX && stairLocal.x + layout.serviceStair.radius <= storage.maxX);
      assert.ok(stairLocal.z - layout.serviceStair.radius >= storage.minZ && stairLocal.z + layout.serviceStair.radius <= storage.maxZ);
      for (const block of plan.metadata.collision.cameraBlocks) {
        const local = layout.toLocal(block.x, block.z);
        if (block.y + block.halfY > bed.position.y + 0.02 && block.y - block.halfY < bed.position.y + 0.75 * bed.scale.y) {
          const overlaps = Math.abs(local.x - bedLocal.x) < block.halfX + 0.6 * bed.scale.x - 1e-6 && Math.abs(local.z - bedLocal.z) < block.halfZ + 0.9 * bed.scale.z - 1e-6;
          assert.equal(overlaps, false, `${style}/${side} bed intersects masonry`);
        }
        if (block.y - block.halfY < layout.origin.y + 0.8 && block.y + block.halfY > layout.origin.y) {
          const dx = Math.max(0, Math.abs(local.x - stairLocal.x) - block.halfX);
          const dz = Math.max(0, Math.abs(local.z - stairLocal.z) - block.halfZ);
          assert.ok(Math.hypot(dx, dz) >= layout.serviceStair.radius, `${style}/${side} service opening intersects masonry`);
        }
      }
    }
  }
});


it("keeps the front balcony empty when the bedroom occupies the rear keep", () => {
  const plan = makePlan();
  plan.metadata.runtime.residential = {
    gatehouseDepth: 2.75,
    upperRoom: { x: 14, z: 23.5, width: 4, depth: 2.25 },
    balcony: { startDepth: 0, endDepth: 2.25 },
    stair: { x: 15.25, z: 24.125, radius: 0.6 },
    basement: { x: 14, z: 22.375, width: 7, depth: 4, floorY: 0.5 },
  };
  const layout = new CastleResidentialLayout(plan);
  const balcony = layout.rooms.balcony;
  assert.equal(balcony.minZ, 0);
  assert.equal(balcony.maxZ, 2.25);
  for (const item of layout.placements.filter((placement) => placement.position.y === balcony.floorY)) {
    assert.ok(layout.toLocal(item.position.x, item.position.z).z > balcony.maxZ);
  }
  const stairs = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
  const service = layout.toLocal(layout.serviceStair.center.x, layout.serviceStair.center.z);
  assert.ok(stairs.z > balcony.maxZ);
  assert.ok(Math.hypot(stairs.x - service.x, stairs.z - service.z) > layout.stairs.radius + layout.serviceStair.radius);
});


it("places closed windows outward on occupied-floor sidewalls and authored front towers", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
    const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 }, doors: [{ side, offset: 3, width: 2 }], style: "twin-tower" });
    const layout = new CastleResidentialLayout(plan);
    const windows = layout.exteriorWindows;
    assert.ok(windows.length > 0 && windows.length <= 13 + plan.structure.towers.length);
    for (const window of windows.filter((item) => item.role === "squareWindow" && item.position.y > layout.rooms.bedroom.floorY && Math.abs(item.yaw - layout.yaw) === 90)) {
      const local = layout.toLocal(window.position.x, window.position.z);
      const room = layout.rooms.bedroom;
      assert.ok(local.x < room.minX || local.x > room.maxX);
      assert.ok(local.z > room.minZ && local.z < room.maxZ);
      assert.equal(window.yaw - layout.yaw, local.x < room.minX ? -90 : 90);
      assert.ok(window.position.y >= room.floorY);
    }
    for (const window of windows.filter((window) => window.role === "squareWindow" && window.position.y < layout.rooms.bedroom.floorY && Math.abs(window.yaw - layout.yaw) === 90)) {
      const local = layout.toLocal(window.position.x, window.position.z);
      const work = layout.rooms.work;
      assert.ok(local.x < work.minX || local.x > work.maxX);
      assert.ok(local.z > work.minZ && local.z < work.maxZ);
      assert.equal(window.yaw - layout.yaw, local.x < work.minX ? -90 : 90);
      assert.ok(window.position.y > work.floorY && window.position.y + 0.8 < layout.rooms.bedroom.floorY);
    }
    const rearWindows = windows.filter((window) => window.role === "squareWindow" && window.yaw === layout.yaw);
    assert.ok(rearWindows.length > 0 && rearWindows.length <= 5);
    for (const window of rearWindows) {
      assert.ok(layout.toLocal(window.position.x, window.position.z).z > layout.rooms.work.maxZ);
    }
    for (const [index, window] of windows.filter((window) => window.role === "towerWindow").entries()) {
      const tower = plan.structure.towers[index];
      const bannerRail = layout.origin.y + (tower.height - 8 + 0.5 + 4.5 / 2) * 0.25 + 0.035;
      assert.ok(window.position.y > bannerRail + 0.025);
      assert.ok(window.position.y + 0.8 * window.scale.y < layout.origin.y + (tower.height - 2) * 0.25);
      assert.equal(window.yaw - layout.yaw, tower.front ? 180 : 0);
      assert.ok(tower.front ? layout.toLocal(window.position.x, window.position.z).z < 0 : layout.toLocal(window.position.x, window.position.z).z > layout.rooms.work.maxZ);
    }
  }
});

it("uses room-first bounds and shared reservations instead of tower-inclusive dimensions", () => {
  const plan = makePlan();
  plan.metadata.runtime.residential = {
    rooms: { work: { minX: -2.5, maxX: 2.5, minZ: 0.375, maxZ: 4.5, floorY: 3, purpose: "work" } },
    stair: { x: 17, z: 23.75, radius: 0.5 },
    serviceStair: { x: 11, z: 21.9, radius: 0.45 },
    serviceDoor: { x: 11.5, y: 3, z: 21.9, yaw: 90 },
    reservations: {
      workDesk: { minX: -2.45, maxX: -1.15, minZ: 0.8, maxZ: 1.8, minY: 0, maxY: 0.8 },
      throne: { minX: -1.4, maxX: 1.4, minZ: 2.6, maxZ: 4.4, minY: 0, maxY: 2.5 },
      centralAisle: { minX: -0.6, maxX: 0.6, minZ: 0.375, maxZ: 2.6, minY: 0, maxY: 3 },
    },
  };
  const layout = new CastleResidentialLayout(plan);
  assert.equal(layout.rooms.work.minX, -2.5);
  const desk = layout.placements.find((item) => item.role === "workDesk");
  const local = layout.toLocal(desk.position.x, desk.position.z);
  assert.ok(Math.abs(local.x + 1.8) < 1e-6);
  assert.ok(Math.abs(local.z - 1.3) < 1e-6);
  assert.equal(layout.serviceDoor.yaw, 90);
  assert.equal(layout.serviceStair.center.x, 11);
  assert.ok(layout.reservations.some((item) => item.role === "bookcase"));
  assert.deepEqual(layout.reservations.find((item) => item.role === "throne"), { role: "throne", ...plan.metadata.runtime.residential.reservations.throne });
});


it("keeps desk and books clear of shared aisle, throne, and stair reservations", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 }, doors: [{ side, offset: 3, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      for (const item of layout.reservations.filter((entry) => ["workDesk", "bookcase"].includes(entry.role))) {
        for (const route of layout.reservations.filter((entry) => ["centralAisle", "throne", "mainStair", "serviceStair"].includes(entry.role))) {
          const overlaps = item.minX < route.maxX && item.maxX > route.minX && item.minZ < route.maxZ && item.maxZ > route.minZ;
          assert.equal(overlaps, false, `${style}/${side} ${item.role} overlaps ${route.role}`);
        }
      }
      const stair = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
      for (const placement of layout.placements.filter((entry) => ["royalBed", "wardrobe", "readingChair"].includes(entry.role))) {
        const point = layout.toLocal(placement.position.x, placement.position.z);
        const dimensions = { royalBed: [1.2, 1.8], wardrobe: [0.65, 0.46], readingChair: [0.75, 0.735] }[placement.role];
        const dx = Math.max(Math.abs(point.x - stair.x) - dimensions[0] * placement.scale.x / 2, 0);
        const dz = Math.max(Math.abs(point.z - stair.z) - dimensions[1] * placement.scale.z / 2, 0);
        assert.ok(Math.hypot(dx, dz) > layout.stairs.radius, `${style}/${side} ${placement.role} intersects spiral rail`);
      }
    }
  }
});

it("keeps canonical desk on the viewer's left and main stairs on the right", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-tower", "single-tower"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 }, doors: [{ side, offset: 3, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const desk = layout.placements.find((item) => item.role === "workDesk");
      assert.ok(layout.toLocal(desk.position.x, desk.position.z).x > 0);
      assert.ok(layout.toLocal(layout.stairs.center.x, layout.stairs.center.z).x < 0);
      const books = layout.reservations.find((item) => item.role === "bookcase");
      assert.ok(books.minX > 0);
    }
  }
});





it("keeps the bedroom-to-side-terrace corridor clear across all generated layouts", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  const dimensions = { royalBed: [1.2, 1.8], wardrobe: [0.65, 0.46], readingChair: [0.75, 0.735] };
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle", "twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 12, depth: 12, elevation: 3 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const corridor = layout.reservations.find((item) => item.role === "sideDoor");
      assert.ok(corridor);
      assert.ok(layout.rooms.sideTerrace);
      for (const item of layout.placements.filter((entry) => dimensions[entry.role])) {
        const local = layout.toLocal(item.position.x, item.position.z);
        const [width, depth] = dimensions[item.role];
        const overlaps = local.x - width * item.scale.x / 2 < corridor.maxX && local.x + width * item.scale.x / 2 > corridor.minX && local.z - depth * item.scale.z / 2 < corridor.maxZ && local.z + depth * item.scale.z / 2 > corridor.minZ;
        assert.equal(overlaps, false, `${style}/${side} ${item.role} blocks side terrace`);
        assert.ok(local.x - width * item.scale.x / 2 >= layout.rooms.bedroom.minX && local.x + width * item.scale.x / 2 <= layout.rooms.bedroom.maxX);
        assert.ok(local.z - depth * item.scale.z / 2 >= layout.rooms.bedroom.minZ && local.z + depth * item.scale.z / 2 <= layout.rooms.bedroom.maxZ);
      }
      const door = layout.toLocal(plan.metadata.runtime.residential.sideDoor.x, plan.metadata.runtime.residential.sideDoor.z);
      for (const window of layout.exteriorWindows.filter((item) => item.role === "squareWindow" && item.position.y > layout.rooms.bedroom.floorY && Math.abs(item.yaw - layout.yaw) === 90)) {
        const local = layout.toLocal(window.position.x, window.position.z);
        if (Math.abs(local.x - door.x) < 0.5) {
          assert.ok(Math.abs(local.z - door.z) > 0.45 + 0.3);
        }
      }
      assert.equal(layout.placements.filter((item) => item.role === "workDesk").length, 1);
    }
  }
});

it("uses generated building windows and connected walkable areas at the actor's current floor", () => {
  const plan = makePlan("WEST");
  plan.metadata.runtime.residential = {
    exteriorWindows: [{ role: "squareWindow", position: { x: 10, y: 6, z: 22 }, scale: { x: 1, y: 1, z: 1 }, yaw: 90 }],
    walkableAreas: [{ id: "courtyard", bounds: { minX: -8, maxX: -7, minZ: 0, maxZ: 1 }, floorY: 3 }],
  };
  const layout = new CastleResidentialLayout(plan);
  const point = layout.toWorld(-7.5, 0.5);
  assert.deepEqual(layout.exteriorWindows, plan.metadata.runtime.residential.exteriorWindows);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, 3), 3);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, 6), null);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, 0.5), null);
});

it("supports each generated connecting doorway across both sides of its threshold", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 12, elevation: 0 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      for (const door of plan.metadata.runtime.residential.secondaryDoors) {
        const angle = door.yaw * Math.PI / 180;
        for (const distance of [-0.3, -0.1, 0, 0.1, 0.3]) {
          const x = door.x + Math.sin(angle) * distance;
          const z = door.z + Math.cos(angle) * distance;
          assert.equal(layout.surfaceHeightAt(x, z, door.y), door.y, `${style}/${side}: door threshold ${distance}`);
        }
      }
    }
  }
});

it("supports the full main gate threshold from exterior tread to interior floor", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 12, elevation: 4 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      for (const forward of [-0.24, 0, 0.25, 0.5, 0.75, 0.99]) {
        for (const lateral of [-0.6, 0, 0.6]) {
          const point = layout.toWorld(lateral, forward);
          assert.equal(layout.surfaceHeightAt(point.x, point.z, 4.05), 4, `${style}/${side} threshold ${lateral}/${forward}`);
        }
      }
      const outside = layout.toWorld(1.2, 0);
      assert.equal(layout.surfaceHeightAt(outside.x, outside.z, 4), null);
    }
  }
});
it("grounds every authored buttress on its actual terrain without widening its footprint", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const side of ["NORTH", "EAST", "SOUTH", "WEST"]) {
    const plan = await CastleGenerator.generate({ position: { x: -6, z: -5.5, width: 12, depth: 11, elevation: 4 },
      doors: [{ side, offset: 5, width: 2 }], style: "twin-keeps" });
    const map = { cols: 40, rows: 40, heightmap: Array.from({ length: 40 }, () => Array(40).fill(2)) };
    const layout = new CastleResidentialLayout(plan);
    const first = layout.exteriorButtresses[0].position;
    map.heightmap[Math.floor(first.z + 20)][Math.floor(first.x + 20)] = 1;
    const footings = createCastleButtressFootings(plan, map);
    assert.equal(footings.length, layout.exteriorButtresses.length);
    for (let index = 0; index < footings.length; index += 1) {
      const footing = footings[index];
      const buttress = layout.exteriorButtresses[index];
      assert.equal(footing.x, buttress.position.x);
      assert.equal(footing.z, buttress.position.z);
      assert.equal(footing.topY, buttress.position.y);
      assert.ok(footing.baseY === 1 || footing.baseY === 2);
      assert.equal(footing.width, 0.6 * buttress.scale.x);
      assert.equal(footing.depth, 0.6 * buttress.scale.z);
    }
    assert.equal(footings[0].baseY, 1, "lowest touched tile supports the whole base");
    plan.metadata.runtime.residential.buttressFootings = footings;
    assert.deepEqual(new CastleResidentialLayout(plan).buttressFootings, footings);
    assert.equal(createCastleButtressFootings(plan, { ...map, heightmap: map.heightmap.map((row) => row.map(() => 4)) }).length, 0,
      "level terrain requires no extra support");
  }
});

it("fits an actor-sized main spiral and its furniture across the five structural grammars", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 11, elevation: 0 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const { radius, innerRadius, center } = layout.stairs;
      assert.equal(radius, 1.6, `${style}/${side}`);
      assert.ok(radius * 0.59 / 0.65 - innerRadius > 0.92);
      assert.equal(layout.serviceStair.radius, 0.45);
      const stair = layout.toLocal(center.x, center.z);
      for (const block of plan.metadata.collision.cameraBlocks) {
        if (block.y + block.halfY <= 0.1 || block.y - block.halfY > layout.rooms.bedroom.floorY + 0.1) continue;
        const point = layout.toLocal(block.x, block.z);
        const dx = Math.max(Math.abs(point.x - stair.x) - block.halfX, 0);
        const dz = Math.max(Math.abs(point.z - stair.z) - block.halfZ, 0);
        assert.ok(Math.hypot(dx, dz) >= radius - 1e-6, `${style}/${side} stair masonry`);
      }
      for (const item of layout.placements.filter(({ role }) => ["royalBed", "wardrobe", "readingChair"].includes(role))) {
        const point = layout.toLocal(item.position.x, item.position.z);
        const dimensions = { royalBed: [1.2, 1.8], wardrobe: [0.65, 0.46], readingChair: [0.75, 0.735] }[item.role];
        const dx = Math.max(Math.abs(point.x - stair.x) - dimensions[0] * item.scale.x / 2, 0);
        const dz = Math.max(Math.abs(point.z - stair.z) - dimensions[1] * item.scale.z / 2, 0);
        assert.ok(Math.hypot(dx, dz) >= radius + 0.05, `${style}/${side} ${item.role}`);
      }
      for (const tread of layout.stairs.treads) {
        const radial = Math.hypot(tread.x - center.x, tread.z - center.z);
        assert.ok(radial - innerRadius > 0.60 && radius * 0.59 / 0.65 - radial > 0.60);
        assert.equal(layout.stairSurfaceHeightAt(tread.x, tread.z, tread.y), tread.y);
      }
    }
  }
});

it("keeps courtyard ground support connected after enlarging the upper stair keep", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["courtyard-keep", "l-courtyard"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 11, elevation: 4 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const door = plan.metadata.runtime.residential.secondaryDoors.find((item) => item.y === layout.origin.y);
      const local = layout.toLocal(door.x, door.z);
      for (let forward = 0; forward <= local.z + 0.35; forward += 0.05) {
        const point = layout.toWorld(local.x, forward);
        assert.equal(layout.surfaceHeightAt(point.x, point.z, layout.origin.y), layout.origin.y, `${style}/${side} ${forward}`);
      }
    }
  }
});


it("keeps windows, apertures and adjoining lanterns outside the occupied main spiral", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 11, elevation: 4 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const stair = layout.stairs;
      for (const window of layout.exteriorWindows) {
        if (window.position.y > stair.center.y + stair.rise + 1.65) { continue; }
        const angle = window.yaw * Math.PI / 180;
        for (const lateral of [-0.65, 0, 0.65]) {
          for (const normal of [-0.5, 0, 0.12]) {
            const x = window.position.x + Math.cos(angle) * lateral + Math.sin(angle) * normal;
            const z = window.position.z - Math.sin(angle) * lateral + Math.cos(angle) * normal;
            assert.ok(Math.hypot(x - stair.center.x, z - stair.center.z) > stair.radius + 0.1, `${style}/${side} ${window.role}`);
          }
        }
      }
      assert.equal(plan.metadata.runtime.residential.windowOpenings.length, layout.exteriorWindows.length);
    }
  }
});


it("contains the complete main spiral inside solid primary keep walls", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  const { castleRoomCore, isCastleCoreVoid } = await import("../../../../../src/game/generator/castle/CastleGeometry.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 11, elevation: 4 }, doors: [{ side, offset: 5, width: 2 }], style });
      const core = castleRoomCore(plan.layout);
      const building = core.primaryBuilding;
      const stair = core.mainStair;
      const clearance = stair.radius + 0.05;
      const layout = new CastleResidentialLayout(plan);
      const keep = plan.metadata.runtime.residential.buildings.find((item) => item.id === "residence").bounds;
      const landing = layout.walkableAreas.find((item) => item.id === "mainStairLanding");
      assert.ok(landing.minX >= keep.minX && landing.maxX <= keep.maxX && landing.minZ >= keep.minZ && landing.maxZ <= keep.maxZ, `${style}/${side} landing protrudes through keep wall`);
      if (core.courtyard) {
        assert.equal(core.startU - 1, building.startU, `${style}/${side} ground enclosure must follow resized keep`);
        for (let v = Math.ceil(stair.blockV - stair.radius / 0.25); v <= Math.floor(stair.blockV + stair.radius / 0.25); v++) {
          if (core.workDoor && Math.abs(v - core.workDoor.blockV) < 4) { continue; }
          assert.equal(isCastleCoreVoid({ blockU: core.startU - 1, blockV: v, blockY: 5, layout: plan.layout }), false, `${style}/${side} courtyard-facing stair enclosure`);
        }
      }
      for (const distance of [stair.blockU - building.startU, building.endU - stair.blockU, stair.blockV - building.startV, building.endV - stair.blockV]) {
        assert.ok((distance - 0.5) * 0.25 >= clearance, `${style}/${side} spiral exceeds interior wall plane`);
      }
      const floor = plan.layout.style.wallHeightBlocks + 1;
      for (let u = building.startU; u <= building.endU; u++) {
        for (const v of [building.startV, building.endV]) {
          if (v === core.sideDoor.blockV && Math.abs(u - core.sideDoor.blockU) < 2) { continue; }
          assert.equal(isCastleCoreVoid({ blockU: u, blockV: v, blockY: floor, layout: plan.layout }), false, `${style}/${side} side wall`
          );
          if (v === 1 || v === plan.layout.facadeSpan - 2) {
            assert.equal(isCastleCoreVoid({ blockU: u, blockV: v, blockY: floor - 1, layout: plan.layout }), false, `${style}/${side} shaft slab exterior wall`);
          }
        }
      }
      for (let v = building.startV; v <= building.endV; v++) {
        for (const u of [building.startU, building.endU]) {
          assert.equal(isCastleCoreVoid({ blockU: u, blockV: v, blockY: floor, layout: plan.layout }), false, `${style}/${side} end wall`);
        }
      }
    }
  }
});


it("provides a solid service entrance landing before the displaced basement shaft", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 11, elevation: 4 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const door = layout.toLocal(layout.serviceDoor.x, layout.serviceDoor.z);
      const shaft = layout.toLocal(layout.serviceStair.center.x, layout.serviceStair.center.z);
      assert.ok(Math.abs(door.z - shaft.z) > layout.serviceStair.radius + 0.6);
      const landing = layout.walkableAreas.find((area) => area.id === "serviceDoorThreshold");
      assert.ok(landing.maxZ <= shaft.z - layout.serviceStair.radius - 0.22);
      for (const step of [0, 0.2, 0.4, 0.6]) {
        const point = layout.toWorld(door.x + Math.sign(shaft.x - door.x) * step, door.z);
        assert.equal(layout.surfaceHeightAt(point.x, point.z, layout.origin.y), layout.origin.y);
      }
    }
  }
});

it("retains masonry above the two-metre side door in taller terraced keeps", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  const { castleRoomCore, isCastleCoreVoid } = await import("../../../../../src/game/generator/castle/CastleGeometry.js");
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 12, elevation: 2 }, doors: [{ side, offset: 5, width: 2 }], style: "terraced-keeps" });
    const core = castleRoomCore(plan.layout);
    const floor = plan.layout.style.wallHeightBlocks + 1;
    for (let u = Math.ceil(core.sideDoor.blockU - 1.9); u < core.sideDoor.blockU + 2; u += 1) {
      for (let y = floor + 8; y < floor + core.primaryBuilding.heightBlocks; y += 1) {
        assert.equal(isCastleCoreVoid({ blockU: u, blockV: core.sideDoor.blockV, blockY: y, layout: plan.layout }), false, `${side}: wall above door must remain solid`);
      }
    }
  }
});

it("connects each basement spiral's upper exit to its ground-floor bay", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 12, elevation: 2 }, doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const stair = layout.serviceStair;
      const center = layout.toLocal(stair.center.x, stair.center.z);
      const landing = layout.walkableAreas.find((area) => area.id === "serviceStairLanding");
      const direction = stair.yaw === layout.yaw ? -1 : 1;
      const z = center.z + direction * stair.radius * 0.335 / 0.65;
      const exit = layout.toWorld(center.x + direction * 0.02, z);
      assert.equal(layout.surfaceHeightAt(exit.x, exit.z, layout.origin.y), layout.origin.y);
      const edgeX = center.x + direction * (stair.radius + 0.2);
      assert.ok(edgeX >= landing.minX && edgeX <= landing.maxX);
      const bay = layout.walkableAreas.find((area) => area.id === "serviceGroundBay");
      assert.ok(Math.min(landing.maxX, bay.maxX) - Math.max(landing.minX, bay.minX) > 0);
      assert.ok(Math.min(landing.maxZ, bay.maxZ) - Math.max(landing.minZ, bay.minZ) > 0);
      assert.equal(stair.center.y + stair.rise, landing.floorY);
    }
  }
});

import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

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


it("preserves compact occupied levels and stair descent in every entrance orientation", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    const plan = await CastleGenerator.generate({ position: { x: -14, z: -8, width: 28, depth: 16, elevation: 3 }, doors: [{ side, offset: 13, width: 2 }], seed: 1 });
    const layout = new CastleResidentialLayout(plan);
    assert.deepEqual([...new Set(layout.walkableAreas.map(area => area.floorY))].sort((a,b) => a-b), [0,3,6]);
    assert.equal(layout.authoredStairs.length, 2);
    assert.ok(layout.canEnterBasement(null));
    for (const stair of layout.authoredStairs) {
      const step = 10.9;
      const angle = Math.PI / 2 - stair.yaw * Math.PI / 180 - step / stair.steps * stair.turns * Math.PI * 2;
      const x = stair.center.x + Math.cos(angle) * stair.radius * .335 / .65;
      const z = stair.center.z + Math.sin(angle) * stair.radius * .335 / .65;
      const lowerTread = stair.center.y + stair.rise * 11 / stair.steps;
      assert.equal(layout.stairSurfaceHeightAt(x,z,lowerTread+.45), lowerTread);
      const lowerFlight = layout.authoredStairs.find(other => other.center.y === stair.center.y - stair.rise && other.yaw === stair.yaw);
      assert.equal(layout.stairSurfaceHeightAt(x,z,stair.center.y-1), lowerFlight ? lowerTread - stair.rise : null);
    }
  }
});

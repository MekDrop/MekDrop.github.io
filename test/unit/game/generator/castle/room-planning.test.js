import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

it("reserves a clear spiral room, keeps audience placement, and connects the upper terrace", async () => {
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: -4, z: -4,
        width: 8, depth: 8, elevation: 3 }, doors: [{ side, offset: 3, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const baseline = new CastleResidentialLayout({ ...plan, metadata: { runtime: {
        ...plan.metadata.runtime, residential: undefined } } });
      assert.deepEqual(layout.rooms.work, baseline.rooms.work);
      assert.deepEqual(layout.reservations.find(({ role }) => role === "throne"),
        baseline.reservations.find(({ role }) => role === "throne"));
      const stair = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
      assert.ok(stair.x + layout.stairs.radius < -0.6, "shaft stays outside carpet");
      assert.ok(stair.z + layout.stairs.radius < layout.rooms.work.maxZ - 1.9,
        "shaft stays in front of throne reservation");
      assert.ok(layout.stairs.radius * (0.59 - 0.08) / 0.65 > 0.92,
        "treads clear the hero body width");
      for (const block of plan.metadata.collision.cameraBlocks) {
        if (block.y + block.halfY <= layout.origin.y ||
          block.y - block.halfY >= layout.rooms.bedroom.floorY + 1.45) continue;
        const local = layout.toLocal(block.x, block.z);
        const distance = Math.hypot(Math.max(0, Math.abs(local.x - stair.x) - block.halfX),
          Math.max(0, Math.abs(local.z - stair.z) - block.halfZ));
        assert.ok(distance >= layout.stairs.radius - 1e-6, `${style}/${side} masonry in shaft`);
      }
      let height = layout.origin.y;
      for (const tread of layout.stairs.treads) {
        assert.equal(layout.stairSurfaceHeightAt(tread.x, tread.z, height), tread.y);
        height = tread.y;
      }
      const door = layout.toLocal(plan.metadata.runtime.terrace.x, plan.metadata.runtime.terrace.z);
      for (let z = layout.rooms.bedroom.maxZ - 0.1; z <= layout.rooms.balcony.minZ + 0.1; z += 0.05) {
        const point = layout.toWorld(door.x, z);
        assert.equal(layout.surfaceHeightAt(point.x, point.z, height), height);
        assert.notEqual(layout.surfaceHeightAt(point.x, point.z, layout.origin.y), height);
      }
    }
  }
});

it("generates the reported map seed with a reserved full-size castle", async () => {
  const { MapGenerator } = await import("../../../../../src/game/generator/map/MapGenerator.js");
  const map = await MapGenerator.generate({ mapName: "muipi14f_1kk6rt6" });
  assert.equal(map.castle.position.width, 8);
  assert.equal(map.castle.position.depth, 8);
  assert.ok(map.objects.length > 0);
});

it("uses the larger side of an off-centre entrance and places the desk opposite", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    for (const offset of [2, 4]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 8, depth: 8, elevation: 3 },
        doors: [{ side, offset, width: 2 }], style: "twin-tower" });
      const layout = new CastleResidentialLayout(plan);
      const stair = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
      const desk = layout.placements.find(({ role }) => role === "workDesk");
      const deskLocal = layout.toLocal(desk.position.x, desk.position.z);
      assert.ok(stair.x * deskLocal.x < 0);
      assert.ok(stair.x - layout.stairs.radius >= plan.layout.roomPlan.envelope.minX);
      assert.ok(stair.x + layout.stairs.radius <= plan.layout.roomPlan.envelope.maxX);
    }
  }
});

it("encloses the upper room and separates its stairwell with a traversable doorway", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 8, depth: 8, elevation: 3 },
      doors: [{ side, offset: 3, width: 2 }], style: "twin-tower" });
    const layout = new CastleResidentialLayout(plan);
    const envelope = plan.layout.roomPlan.envelope;
    const partition = (layout.rooms.stairwell.minX + layout.rooms.stairwell.maxX) / 2 < 0 ? -0.625 : 0.625;
    const solidAt = (x, z, y) => {
      const point = layout.toWorld(x, z, y);
      return plan.metadata.collision.cameraBlocks.some((block) =>
        Math.abs(block.x - point.x) < block.halfX + 1e-6 &&
        Math.abs(block.z - point.z) < block.halfZ + 1e-6 &&
        Math.abs(block.y - point.y) < block.halfY + 1e-6);
    };
    const level = envelope.floorY - layout.origin.y;
    assert.ok(solidAt(envelope.minX - 0.125, 1.125, level + 0.875));
    assert.ok(solidAt(envelope.maxX + 0.125, 1.125, level + 0.875));
    assert.ok(solidAt(1.125, envelope.minZ - 0.125, level + 0.875));
    assert.ok(solidAt(1.125, envelope.maxZ + 0.125, level + 0.875));
    assert.ok(solidAt(partition, 1.125, level + 0.875));
    assert.equal(solidAt(partition, 2.125, level + 0.875), false);
    assert.equal(solidAt(0.125, envelope.maxZ + 0.125, level + 0.875), false);
    assert.ok(solidAt(1.125, 1.125, level + 2.125), "room has a ceiling");
    assert.ok(layout.rooms.bedroom.minX >= layout.rooms.stairwell.maxX ||
      layout.rooms.bedroom.maxX <= layout.rooms.stairwell.minX, "bedroom is separate from shaft");
  }
});

it("keeps basement excavation rotated under the castle with a sealed soil ceiling", async () => {
  const { createCastleGroundCuts } = await import("../../../../../src/game/objects/castle/CastleGroundCuts.js");
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
      doors: [{ side, offset: 3, width: 2 }], style: "twin-tower" });
    const layout = new CastleResidentialLayout(plan);
    const cuts = createCastleGroundCuts(plan, layout);
    assert.ok(cuts.every((cut) => Object.values(cut).every(Number.isFinite)));
    const basement = cuts.find((cut) => cut.minY === layout.basement.floorY);
    assert.ok(basement);
    assert.equal(basement.maxY, layout.origin.y - 0.25);
    assert.ok(basement.minX >= plan.input.position.x && basement.maxX <= plan.input.position.x + 8);
    assert.ok(basement.minZ >= plan.input.position.z && basement.maxZ <= plan.input.position.z + 8);
  }
});

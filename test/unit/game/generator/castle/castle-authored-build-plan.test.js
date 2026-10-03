import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { CastleWindowLayout } from "../../../../../src/game/objects/castle/CastleWindowLayout.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

it("builds all reference plans in each gate orientation, preserving authored aperture centres", async () => {
  for (const source of await CastleBasePlanGenerator.plans) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const crosswise = ["WEST", "EAST"].includes(side);
      const slot = source.levels.find((floor) => floor.index === 0).spaces.find((space) => space.id === source.entrance.spaceId);
      const offset = Math.round((slot.bounds[0] + source.entrance.offset + source.entrance.width / 2) * 28 / 104 - 1);
      const plan = await CastleAuthoredBuildPlan.generate({ basePlanId: source.id,
        position: { x: -8, z: -14, width: crosswise ? 16 : 28, depth: crosswise ? 28 : 16, elevation: 3 },
        doors: [{ side, offset, width: 2 }], seed: "reference" });
      assert.equal(plan.layout.basePlanId, source.id);
      assert.ok(plan.geometry.boxes.every((brick) => brick.sx <= 0.250001 && brick.sy <= 0.250001 && brick.sz <= 0.250001),
        "authored masonry uses the gate's quarter-metre bricks");
      const solids = plan.metadata.collision.cameraBlocks;
      for (let index = 0; index < solids.length; index++) {
        const a = solids[index];
        for (const b of solids.slice(index + 1)) {
          assert.ok(Math.abs(a.x - b.x) >= a.halfX + b.halfX - 1e-6 ||
            Math.abs(a.y - b.y) >= a.halfY + b.halfY - 1e-6 ||
            Math.abs(a.z - b.z) >= a.halfZ + b.halfZ - 1e-6,
          `${source.id}/${side}: masonry junctions have one surface owner`);
        }
      }
      const layout = new CastleResidentialLayout(plan);
      const windows = new CastleWindowLayout(plan);
      assert.equal(windows.windows.length, plan.layout.roomPlan.openings.filter((opening) => opening.kind === "window").length);
      assert.equal(layout.authoredStairs.length, source.staircases.reduce((sum, shaft) => sum + shaft.to - shaft.from, 0));
      assert.equal(plan.layout.roomPlan.placedRooms.length, source.levels.reduce((sum, floor) => sum + floor.spaces.filter((space) => space.kind === "room").length, 0));
      for (const opening of plan.layout.roomPlan.openings) {
        if (opening.kind !== "door") { continue; }
        const sign = ["NORTH", "WEST"].includes(opening.side) ? -1 : 1;
        const point = layout.toWorld(opening.axis === "x" ? opening.coordinate + sign * 0.125 : opening.center,
          opening.axis === "z" ? opening.coordinate + sign * 0.125 : opening.center, opening.floorY - layout.origin.y + 1);
        assert.ok(!plan.metadata.collision.cameraBlocks.some((box) =>
          Math.abs(point.x - box.x) < box.halfX - 1e-6 && Math.abs(point.y - box.y) < box.halfY - 1e-6 &&
          Math.abs(point.z - box.z) < box.halfZ - 1e-6), `${source.id}/${side}/${opening.roomId}: door clear of masonry`);
      }
      const cutBoxes = windows.cutBoxes(plan.geometry.boxes);
      for (const window of windows.windows) {
        assert.ok(!cutBoxes.some((box) => CastleWindowLayout.intersects(CastleWindowLayout.bounds(box), window.cut)), "window aperture is open in rendered masonry");
      }
      for (const area of layout.walkableAreas) {
        assert.ok(area.maxX > area.minX && area.maxZ > area.minZ);
        for (const space of plan.layout.roomPlan.spaces) {
          if (space.kind !== "void" || space.floorY !== area.floorY) { continue; }
          assert.ok(!(area.minX < space.maxX - 1e-6 && area.maxX > space.minX + 1e-6 &&
            area.minZ < space.maxZ - 1e-6 && area.maxZ > space.minZ + 1e-6), `${source.id}: ${area.id} fills void ${space.id}`);
        }
      }
      for (const stair of layout.authoredStairs) {
        const radians = stair.yaw * Math.PI / 180;
        const angle = Math.PI / 2 - radians - 0.5 / stair.steps * stair.turns * Math.PI * 2;
        const x = stair.center.x + Math.cos(angle) * stair.radius * 0.335 / 0.65;
        const z = stair.center.z + Math.sin(angle) * stair.radius * 0.335 / 0.65;
        const height = layout.stairSurfaceHeightAt(x, z, stair.center.y);
        assert.ok(height !== null && height > stair.center.y && height <= stair.center.y + 0.32, `${source.id}: accessible stair ${stair.id}`);
      }
    }
  }
});

it("new generated maps carry the selected reference plan through to the Castle object", async () => {
  for (const numPaths of [1, 2, 3, 4]) {
    const map = await MapGenerator.generate({ mapName: `dimensioned-castle:${numPaths}`, numPaths, numRivers: 0 });
    const castle = map.objects.find((object) => object.object === "Castle");
    assert.equal(castle.basePlanId, map.castle.basePlanId);
    assert.equal(castle.basePlanId, (await CastleBasePlanGenerator.generate({ seed: castle.seed })).basePlanId);
    assert.equal(castle.buildPlan.layout.basePlanId, castle.basePlanId);
    assert.equal(castle.buildPlan.input.position.width, 16);
    assert.equal(castle.buildPlan.input.position.depth, 28);
    assert.equal(castle.buildPlan.input.doors[0].width, 2);
  }
});

it("builds the compact reference as one base with a corner keep and open terrace", async () => {
  const source = await CastleBasePlanGenerator.generate({ baseY: 3 });
  assert.equal(source.basePlanId, "castle-demo-compact");
  assert.equal(source.buildings.length, 2);
  const [base, keep] = source.buildings;
  assert.equal(base.floorY, 0);
  assert.equal(base.floorY + base.height, 6);
  assert.equal(keep.floorY, 6);
  assert.equal(keep.floorY + keep.height, 9);
  assert.equal(keep.maxX, base.maxX);
  assert.equal(keep.minZ, base.minZ);
  assert.equal(source.roofs.length, 1);
  assert.equal(source.roofs[0].y + source.roofs[0].height, 11);
  const plan = await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:"NORTH",offset:13,width:2}],seed:1});
  const layout = new CastleResidentialLayout(plan);
  const terrace = plan.layout.roomPlan.spaces.filter((space) => space.kind === "terrace");
  assert.equal(terrace.length, 2);
  for (const area of terrace) {
    const point = layout.toWorld((area.minX+area.maxX)/2, (area.minZ+area.maxZ)/2, 3.5);
    assert.ok(!plan.metadata.collision.cameraBlocks.some((box) => Math.abs(point.x-box.x)<box.halfX && Math.abs(point.z-box.z)<box.halfZ && Math.abs(point.y-box.y)<box.halfY), "terrace remains open above its deck");
  }
});


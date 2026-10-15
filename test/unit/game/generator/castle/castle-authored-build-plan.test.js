import assert from "node:assert/strict";
import { castleStraightStairSurfaces } from "../../../../../src/game/objects/castle/CastleStraightStairs.js";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { CastleWindowLayout } from "../../../../../src/game/objects/castle/CastleWindowLayout.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

it("fits the compact roof to the upper shell's outer wall faces without extra eaves", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    for (const seed of [0, 1]) {
      const plan = await CastleGenerator.generate({
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
      const residential = plan.metadata.runtime.residential;
      const keep = residential.buildings.find(building => building.floorY === residential.origin.y + residential.floorHeight);
      const roof = plan.geometry.decorations.roofs[0];
      const center = new CastleResidentialLayout(plan).toLocal(roof.x, roof.z);
      assert.equal(roof.width, keep.maxX - keep.minX + 0.5);
      assert.equal(roof.depth, keep.maxZ - keep.minZ + 0.5);
      assert.ok(Math.abs(center.x - (keep.minX + keep.maxX) / 2) < 1e-6);
      assert.ok(Math.abs(center.z - (keep.minZ + keep.maxZ) / 2) < 1e-6);
    }
  }
});

it("builds all reference plans in each gate orientation, preserving authored aperture centres", async () => {
  for (const source of await CastleBasePlanGenerator.plans) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const crosswise = ["WEST", "EAST"].includes(side);
      const slot = source.levels.find((floor) => floor.index === 0).spaces.find((space) => space.id === source.entrance.spaceId);
      const offset = Math.round((slot.bounds[0] + source.entrance.offset + source.entrance.width / 2) * 28 / 104 - 1);
      const plan = await CastleAuthoredBuildPlan.generate({
        basePlanId: source.id,
        position: {
          x: -8,
          z: -14,
          width: crosswise ? 16 : 28,
          depth: crosswise ? 28 : 16,
          elevation: 3,
        },
        doors: [{
          side,
          offset,
          width: 2,
        }],
        seed: 0,
      });
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
        const [incoming, landing] = castleStraightStairSurfaces(stair);
        assert.equal(landing.low, incoming.high, `${source.id}: turning landing meets the incoming tread without a lip`);
        assert.equal(landing.high, incoming.high);
        const radians = stair.yaw * Math.PI / 180;
        const localX = -stair.radius / 2, localZ = stair.radius - 0.05;
        const x = stair.center.x + localX * Math.cos(radians) + localZ * Math.sin(radians);
        const z = stair.center.z - localX * Math.sin(radians) + localZ * Math.cos(radians);
        const height = layout.stairSurfaceHeightAt(x, z, stair.center.y);
        assert.ok(height !== null && height > stair.center.y && height <= stair.center.y + 0.32, `${source.id}: accessible stair ${stair.id}`);
      }
    }
  }
});

it("new generated maps carry the selected reference plan through to the Castle object", async () => {
  for (const numPaths of [1, 2, 3, 4]) {
    const map = await MapGenerator.generate({
      mapName: `dimensioned-castle:${numPaths}`,
      numPaths,
      numRivers: 0,
    });
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
  const plan = await CastleGenerator.generate({
    position:{
      x:-14,
      z:-8,
      width:28,
      depth:16,
      elevation:3,
    },
    doors:[{
      side:"NORTH",
      offset:13,
      width:2,
    }],
    seed:0,
  });
  const layout = new CastleResidentialLayout(plan);
  const terrace = plan.layout.roomPlan.spaces.filter((space) => space.kind === "terrace");
  assert.equal(terrace.length, 2);
  for (const area of terrace) {
    const point = layout.toWorld((area.minX+area.maxX)/2, (area.minZ+area.maxZ)/2, 3.5);
    assert.ok(!plan.metadata.collision.cameraBlocks.some((box) => Math.abs(point.x-box.x)<box.halfX && Math.abs(point.z-box.z)<box.halfZ && Math.abs(point.y-box.y)<box.halfY), "terrace remains open above its deck");
  }
});

it("keeps the upper landing door swing clear of masonry in every castle orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleAuthoredBuildPlan.generate({
      basePlanId: "castle-demo-compact",
      position: {
        x: 0,
        z: 0,
        width: 16,
        depth: 16,
        elevation: 0,
      },
      doors: [{
        side,
        offset: 7,
        width: 2,
      }],
      seed: "door-swing",
    });
    const door = plan.metadata.runtime.roomDoors.find((entry) => entry.roomId === "upper-stair-room");
    assert.ok(door);
    const yaw = door.yaw * Math.PI / 180;
    for (let angle = 0; angle <= 90; angle += 5) {
      const radians = angle * Math.PI / 180;
      for (let along = 0; along <= 1; along += 0.05) {
        for (const thickness of [-0.045, 0.045]) {
          const x = -door.width * 0.5075 + (along * door.width + door.width * 0.0075) * Math.cos(radians) - (thickness - 0.0575) * Math.sin(radians);
          const z = 0.0575 + (along * door.width + door.width * 0.0075) * Math.sin(radians) + (thickness - 0.0575) * Math.cos(radians);
          const point = {
            x: door.x + 0.155 * Math.sin(yaw) + x * Math.cos(yaw) + z * Math.sin(yaw),
            z: door.z + 0.155 * Math.cos(yaw) - x * Math.sin(yaw) + z * Math.cos(yaw),
            y: door.y + door.height / 2,
          };
          assert.ok(!plan.metadata.collision.cameraBlocks.some((box) =>
            Math.abs(point.x - box.x) < box.halfX - 1e-6 &&
            Math.abs(point.y - box.y) < box.halfY - 1e-6 &&
            Math.abs(point.z - box.z) < box.halfZ - 1e-6), `${side}: door intersects wall at ${angle} degrees`);
        }
      }
    }
  }
});

it("keeps the world entrance fixed when odd seeds mirror the castle in each orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const options = {
      position: {
        x: 0,
        z: 0,
        width: 16,
        depth: 16,
        elevation: 3,
      },
      doors: [{
        side,
        offset: 7,
        width: 2,
      }],
    };
    const original = await CastleGenerator.generate({
      ...options,
      seed: 42,
    });
    const mirrored = await CastleGenerator.generate({
      ...options,
      seed: 43,
    });
    assert.deepEqual(mirrored.layout.roomPlan.origin, original.layout.roomPlan.origin);
    const door = (plan) => plan.layout.roomPlan.openings.find((entry) => entry.exteriorEntrance);
    assert.ok(door(original));
    assert.deepEqual(door(mirrored), door(original));
    const a = original.layout.roomPlan.spaces.find((room) => room.id === "throne-hall");
    const b = mirrored.layout.roomPlan.spaces.find((room) => room.id === "throne-hall");
    assert.equal(b.minX, -a.maxX);
    assert.equal(b.maxX, -a.minX);
  }
});

it("places restored royal activities on an open terrace in every entrance orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    for (const seed of [0, 1]) {
      const plan = await CastleGenerator.generate({
        position: {
          x: -8,
          z: -8,
          width: 16,
          depth: 16,
          elevation: 3,
        },
        doors: [{
          side,
          offset: 7,
          width: 2,
        }],
        seed,
      });
      const activity = plan.metadata.runtime.terrace;
      assert.ok(activity, "authored castles provide a terrace activity location");
      assert.ok(activity.depth > 0 && activity.width > 0);
      const entrance = plan.metadata.runtime.roomDoors.find((door) => door.roomId === activity.doorRoomId);
      assert.ok(entrance, "the sequence reuses an authored door");
      assert.deepEqual([activity.x, activity.y, activity.z], [entrance.x, entrance.y, entrance.z]);
      const layout = new CastleResidentialLayout(plan);
      const center = layout.toLocal(activity.serviceCenter.x, activity.serviceCenter.z);
      const serviceAreas = plan.layout.roomPlan.spaces.filter((area) => area.kind === "terrace" && area.floorY === activity.y);
      const centerX = (Math.min(...serviceAreas.map((area) => area.minX)) + Math.max(...serviceAreas.map((area) => area.maxX))) / 2;
      const centerZ = (Math.min(...serviceAreas.map((area) => area.minZ)) + Math.max(...serviceAreas.map((area) => area.maxZ))) / 2;
      assert.ok(Math.abs(center.x - centerX) < 1e-6, "service uses the full terrace width");
      assert.ok(Math.abs(center.z - centerZ) < 1e-6, "service uses the full terrace depth");
      const angle = activity.yaw * Math.PI / 180;
      const scale = Math.min(0.45, activity.depth / 5.5, activity.width / 4.2);
      for (const [x, z] of [[0, 0], [0, 1.6 * scale], [0, 3.1 * scale], [-0.75 * scale, 3.2 * scale]]) {
        const point = {
          x: activity.x + Math.cos(angle) * x + Math.sin(angle) * z,
          z: activity.z - Math.sin(angle) * x + Math.cos(angle) * z,
        };
        const local = layout.toLocal(point.x, point.z);
        assert.ok(plan.layout.roomPlan.spaces.some((area) => area.kind === "terrace" &&
          area.floorY === activity.y && local.x >= area.minX - 0.00001 && local.x <= area.maxX + 0.00001 &&
          local.z >= area.minZ - 0.00001 && local.z <= area.maxZ + 0.00001), "inspection and royal destinations stay on the terrace floor");
      }
    }
  }
});

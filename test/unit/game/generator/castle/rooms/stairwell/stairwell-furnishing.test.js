import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { StairwellRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/stairwell/StairwellRoomGenerator.js";
import { CastleGenerator } from "../../../../../../../src/game/generator/castle/CastleGenerator.js";
import { StairwellRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/stairwell/StairwellRoomMapObjects.js";

it("reproduces sparse stair-room decoration and varies independent seed pairs", async () => {
  const first = await CastleBasePlanGenerator.generate({ seed: 42 });
  const repeated = await CastleBasePlanGenerator.generate({ seed: 42 });
  const second = await CastleBasePlanGenerator.generate({ seed: 44 });
  const props = plan => plan.furniture.filter(item => item.role === "stairwellProp");
  assert.deepEqual(props(first), props(repeated));
  assert.notDeepEqual(props(first), props(second));
  assert.deepEqual(first.stairs, second.stairs);
  for (const room of ["basement-stair-room", "stair-room"]) {
    assert.ok(props(first).some(item => item.roomId === room));
  }
});

it("keeps measured lantern bounds, apertures and the full stair approach clear", async () => {
  for (const planId of ["castle-demo-compact", "castle-01", "castle-03", "castle-04"]) {
    for (const seed of [2, 3, 42, 44, 46, 100]) {
      const plan = await CastleBasePlanGenerator.generate({ planId, seed, baseY: 3 });
      for (const item of plan.furniture.filter(item => item.role === "stairwellProp")) {
        const room = plan.spaces.find(room => room.id === item.roomId && room.floorY === item.floorY);
        if (item.object === "WallLantern") {
          assert.ok(item.y >= 1.75 && item.y + 0.6 < room.height);
          const side = { 0: "NORTH", 90: "WEST", 180: "SOUTH", 270: "EAST" }[((item.rotation % 360) + 360) % 360];
          const along = ["NORTH", "SOUTH"].includes(side) ? item.x : item.z;
          for (const opening of plan.openings.filter(opening => opening.roomId === item.roomId &&
            opening.floorY === item.floorY && opening.side === side)) {
            assert.ok(Math.abs(along - opening.center) >= opening.width / 2 + 0.4);
          }
        } else {
          assert.equal(item.object, "SingleCandleStand");
          assert.equal(item.y, 0.002);
        }
        // Back bracket seats five millimetres into the wall; all other edges are contained.
        assert.ok(item.x - item.width / 2 >= room.minX - 0.006);
        assert.ok(item.x + item.width / 2 <= room.maxX + 0.006);
        assert.ok(item.z - item.depth / 2 >= room.minZ - 0.006);
        assert.ok(item.z + item.depth / 2 <= room.maxZ + 0.006);
        for (const stair of plan.stairs.filter(stair => room.level >= stair.from && room.level <= stair.to)) {
          assert.ok(item.x + item.width / 2 <= stair.minX - 0.4 ||
            item.x - item.width / 2 >= stair.maxX + 0.4 ||
            item.z + item.depth / 2 <= stair.minZ - 0.4 ||
            item.z - item.depth / 2 >= stair.maxZ + 0.4);
        }
      }
    }
  }
});

it("publishes native prop definitions once and replaces stale seed furnishings", async () => {
  const options = { position: { x: -6.5, z: -5.5, width: 12, depth: 11, elevation: 0 },
    doors: [{ side: "NORTH", offset: 5, width: 2 }] };
  const castle = { id: "test-castle", object: "Castle", tile: { col: 15, row: 15 },
    buildPlan: await CastleGenerator.generate({ ...options, seed: 46 }) };
  const map = { objects: [castle] };
  StairwellRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.some(item => item.object === "Crate"));
  for (const object of ["Barrel", "WaterBucket", "StoragePotteryJar"]) {
    assert.ok(first.some(item => item.object === object));
  }
  assert.ok(first.every(item => item.sourceCastleId === castle.id && Number.isFinite(item.position.y)));
  StairwellRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
  castle.buildPlan = await CastleGenerator.generate({ ...options, seed: 44 });
  StairwellRoomMapObjects.prepareMap(map);
  assert.notDeepEqual(map.objects.slice(1), first);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
});

it("omits decoration when a compact host has no safe wall outside its shaft", () => {
  const room = { id: "tight", level: 0, minX: 0, maxX: 3, minZ: 0, maxZ: 3, floorY: 0, height: 3 };
  const stairs = [{ minX: 0, maxX: 3, minZ: 0, maxZ: 3 }];
  assert.deepEqual(new StairwellRoomGenerator("tight").furnish(room, { seed: 1, stairs, openings: [] }), []);
});

it("confines crates to supported low-headroom stair pockets and leaves floor voids empty", async () => {
  for (const seed of [42, 43, 44]) {
    const build = await CastleGenerator.generate({ position: { x: -6.5, z: -5.5, width: 12, depth: 11, elevation: 0 },
      doors: [{ side: "NORTH", offset: 5, width: 2 }], seed });
    const plan = build.metadata.runtime.residential;
    const crates = plan.furniture.filter(item => item.underStair);
    assert.ok(crates.length >= 10, "wall alignment retains the full storage inventory");
    const pocket = crates.filter(item => item.backPocketStorage);
    assert.equal(pocket.length, 2);
    assert.equal(pocket[1].supportId, pocket[0].id);
    assert.equal(pocket[0].x, pocket[1].x);
    assert.equal(pocket[0].z, pocket[1].z);
    for (const [object, count] of Object.entries({ Crate: 12, WoodenStorageChest: 5,
      Barrel: 2, WaterBucket: 1, StoragePotteryJar: 3 })) {
      assert.equal(crates.filter(item => item.object === object).length, count,
        `${object}: wall alignment must preserve the original inventory`);
    }
    assert.ok(crates.every(item => item.floorY === -3));
    for (const barrel of crates.filter(item => item.object === "Barrel")) {
      assert.equal(barrel.y, 0.002, "barrels rest on the pocket floor");
      assert.equal(barrel.tilt, undefined, "barrels remain upright");
    }
    for (const item of crates) {
      const yaw = item.rotation * Math.PI / 180;
      const circular = item.object === "StoragePotteryJar";
      const width = item.width;
      const depth = item.depth;
      const halfX = item.scale * (circular ? Math.max(width, depth) :
        width * Math.abs(Math.cos(yaw)) + depth * Math.abs(Math.sin(yaw))) / 2;
      const halfZ = item.scale * (circular ? Math.max(width, depth) :
        width * Math.abs(Math.sin(yaw)) + depth * Math.abs(Math.cos(yaw))) / 2;
      const height = (item.height ?? 0.4702) * item.scale;
      if (["Crate", "WoodenStorageChest"].includes(item.object)) {
        const stair = plan.authoredStairs.find(stair => item.roomId === `under-stair:${stair.id}`);
        const angle = (stair.yaw - plan.origin.yaw) * Math.PI / 180;
        const along = (item.x - stair.localCenter.x) * Math.sin(angle) +
          (item.z - stair.localCenter.z) * Math.cos(angle);
        const area = plan.walkableAreas.find(area => area.kind === "room" && area.floorY === item.floorY &&
          item.x >= area.minX && item.x <= area.maxX && item.z >= area.minZ && item.z <= area.maxZ);
        const distances = [item.x - halfX - area.minX, area.maxX - item.x - halfX,
          item.z - halfZ - area.minZ, area.maxZ - item.z - halfZ];
        distances.push(distances[2] - 0.25);
        if (!item.supportId) {
          const group = new Set([item.id]);
          for (let level = 0; level < crates.length; level++) {
            for (const child of crates) { if (group.has(child.supportId)) { group.add(child.id); } }
          }
          for (const child of crates) {
            if (!group.has(child.id) || child === item) { continue; }
            const angle = child.rotation * Math.PI / 180;
            const hx = child.scale * (child.width * Math.abs(Math.cos(angle)) + child.depth * Math.abs(Math.sin(angle))) / 2;
            const hz = child.scale * (child.width * Math.abs(Math.sin(angle)) + child.depth * Math.abs(Math.cos(angle))) / 2;
            distances.push(child.x - hx - area.minX, area.maxX - child.x - hx,
              child.z - hz - area.minZ, area.maxZ - child.z - hz, child.z - hz - area.minZ - 0.25);
          }
          assert.ok(distances.some(distance => distance >= -1e-5 && distance <= 0.08),
            JSON.stringify({ seed, item, distances }));
        }
        assert.ok(along < 0.75, "storage leaves the stair approach open");
      }
      if (item.object === "Crate") {
        assert.ok(item.width * item.scale >= (item.backPocketStorage ? 0.35 : 0.48));
        assert.ok(item.y + height <= item.ceiling);
      }
      if (item.y > 0.002 && item.object === "Crate") {
        assert.ok(crates.some(below => Math.abs(below.x - item.x) < 0.3 && Math.abs(below.z - item.z) < 0.3 &&
          Math.abs(below.y + (below.height ?? 0.4702) * below.scale - item.y) < 0.00001));
      }
      const pivotOffset = item.tilt ? item.depth * item.scale / 2 : 0;
      const centerX = item.x - Math.sin(yaw) * pivotOffset;
      const centerZ = item.z - Math.cos(yaw) * pivotOffset;
      assert.ok(plan.walkableAreas.some(area => area.floorY === item.floorY &&
        centerX - halfX >= area.minX - 1e-6 && centerX + halfX <= area.maxX + 1e-6 &&
        centerZ - halfZ >= area.minZ - 1e-6 && centerZ + halfZ <= area.maxZ + 1e-6));
      const x = plan.origin.x + item.x - Math.sin(yaw) * pivotOffset;
      const z = plan.origin.z + item.z - Math.cos(yaw) * pivotOffset;
      assert.ok(!build.metadata.collision.cameraBlocks.some(block =>
        Math.abs(x - block.x) < block.halfX + halfX && Math.abs(z - block.z) < block.halfZ + halfZ &&
        item.floorY + item.y + height > block.y - block.halfY &&
        item.floorY + item.y + 0.01 < block.y + block.halfY), JSON.stringify({ seed, item, halfX, halfZ, blocks: build.metadata.collision.cameraBlocks.filter(block => Math.abs(x-block.x)<block.halfX+halfX && Math.abs(z-block.z)<block.halfZ+halfZ) }));
    }
  }
});

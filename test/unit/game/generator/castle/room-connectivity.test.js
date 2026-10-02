import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

// Check actual collision geometry with a wider clearance than the hero capsule.
function checkRoutes(plan) {
  const layout = new CastleResidentialLayout(plan);
  const residential = plan.layout.roomPlan;
  const radius = 0.4, step = 0.125;
  for (const level of [0, 1]) {
    if (level === 1 && !residential.stair) continue;
    const y = layout.origin.y + level * residential.rise;
    const solids = plan.metadata.collision.cameraBlocks.filter((block) =>
      block.y + block.halfY > y + 0.1 && block.y - block.halfY < y + 1.75)
      .map((block) => ({ ...block, ...layout.toLocal(block.x, block.z) }));
    for (const item of residential.furniture) {
      if (item.floorY !== y) continue;
      solids.push({ x: item.x, z: item.z, halfX: item.width * item.scale / 2, halfZ: item.depth * item.scale / 2 });
    }
    const clear = (x, z) => !solids.some((block) => Math.hypot(
      Math.max(0, Math.abs(block.x - x) - block.halfX),
      Math.max(0, Math.abs(block.z - z) - block.halfZ)) < radius - 1e-6);
    const minX = residential.outerBounds.minX + radius, minZ = residential.outerBounds.minZ + radius;
    const key = (x, z) => `${Math.round((x - minX) / step)},${Math.round((z - minZ) / step)}`;
    const cells = [];
    for (let z = minZ; z <= residential.outerBounds.maxZ - radius; z += step) {
      for (let x = minX; x <= residential.outerBounds.maxX - radius; x += step) {
        if (clear(x, z) && layout.walkableAreas.some((area) => area.floorY === y &&
          x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ)) cells.push({ x, z });
      }
    }
    const landing = layout.walkableAreas.find((area) => area.id === "mainStairLanding");
    const start = level === 0 ? { x: 0, z: 1.1 } : { x: (landing.minX + landing.maxX) / 2, z: (landing.minZ + landing.maxZ) / 2 };
    const nearest = cells.reduce((best, cell) => Math.hypot(cell.x - start.x, cell.z - start.z) <
      Math.hypot(best.x - start.x, best.z - start.z) ? cell : best);
    assert.ok(Math.hypot(nearest.x - start.x, nearest.z - start.z) < 0.2, "route starts at the entrance or actual stair exit");
    const lookup = new Map(cells.map((cell) => [key(cell.x, cell.z), cell]));
    const reached = new Set([key(nearest.x, nearest.z)]), queue = [nearest];
    for (const cell of queue) {
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const id = key(cell.x + dx, cell.z + dz), next = lookup.get(id);
        if (next && !reached.has(id)) { reached.add(id); queue.push(next); }
      }
    }
    for (const room of residential.placedRooms.filter((room) => room.level <= level && room.level + room.floorSpan > level)) {
      assert.ok(cells.some((cell) => cell.x > room.minX + radius && cell.x < room.maxX - radius &&
        cell.z > room.minZ + radius && cell.z < room.maxZ - radius && reached.has(key(cell.x, cell.z))),
      `${plan.input.seed} floor ${level}: ${room.id} is connected with furniture in place`);
    }
    if (level === 1) {
      for (const cell of cells) {
        const inRoom = residential.placedRooms.some((room) => room.level <= level && room.level + room.floorSpan > level &&
          cell.x >= room.minX - radius && cell.x <= room.maxX + radius && cell.z >= room.minZ - radius && cell.z <= room.maxZ + radius);
        if (!inRoom) assert.ok(reached.has(key(cell.x, cell.z)), "every unused terrace cell is reachable from the stair landing" );
      }
    }
    if (level === 0 && layout.stairs) {
      const entry = layout.toLocal(layout.stairs.treads[0].x, layout.stairs.treads[0].z);
      assert.ok(cells.some((cell) => reached.has(key(cell.x, cell.z)) && Math.hypot(cell.x - entry.x, cell.z - entry.z) < 0.2),
        "ground entrance reaches the first stair tread");
    }
  }
}

it("connects every occupied floor and the first stair tread on the reported first-person map", async () => {
  const map = await MapGenerator.generate({ mapName: "muipi14f_1kk6rt6" });
  checkRoutes(map.objects.find((object) => object.object === "Castle").buildPlan);
});

it("preserves wide connected routes for randomized rooms and towers in all orientations", async () => {
  let towers = 0;
  for (const width of [8, 12]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: -width / 2, z: -width / 2, width, depth: width, elevation: 3 },
        doors: [{ side, offset: width / 2 - 1, width: 2 }], style: "twin-tower", seed: `routes-${side}-${width}` });
      towers += plan.layout.roomPlan.placedRooms.filter((room) => room.id.startsWith("tower")).length;
      checkRoutes(plan);
    }
  }
  assert.ok(towers > 0, "checks include towers on both floors");
});

it("connects every castle in the saved seed gallery using current generation", async () => {
  const { readFile } = await import("node:fs/promises");
  const map = JSON.parse(await readFile(new URL("../../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
  const castles = map.objects.filter((object) => object.object === "Castle");
  assert.equal(castles.length, 10);
  for (const castle of castles) {
    assert.equal(castle.buildPlan, undefined, "saved seeds must not freeze generated geometry");
    checkRoutes(await CastleGenerator.generate(castle));
  }
});

it("keeps every planned doorway free of masonry from other shell layers", async () => {
  const { readFile } = await import("node:fs/promises");
  const map = JSON.parse(await readFile(new URL("../../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
  for (const castle of map.objects.filter((object) => object.object === "Castle")) {
    const plan = await CastleGenerator.generate(castle);
    const layout = new CastleResidentialLayout(plan);
    assert.ok(plan.metadata.runtime.roomDoors.every((door) => !door.roomId.startsWith("tower")));
    assert.equal(layout.exteriorButtresses.length, 0);
    for (const door of plan.layout.roomPlan.doorways) {
      for (const block of plan.metadata.collision.cameraBlocks) {
        if (block.y < door.floorY + 0.25 || block.y > door.floorY + 1.75) continue;
        const point = layout.toLocal(block.x, block.z);
        const across = door.axis === "x" ? point.x : point.z;
        const along = door.axis === "x" ? point.z : point.x;
        assert.ok(Math.abs(across - door.coordinate) >= 0.26 - 1e-6 || Math.abs(along - door.center) >= door.width / 2 + 0.125 - 1e-6,
          `${castle.seed}: ${door.roomId} doorway is filled by another wall ${JSON.stringify({door,block,point})}`);
      }
    }
  }
});

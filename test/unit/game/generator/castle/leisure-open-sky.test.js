import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

it("keeps ground and upstairs leisure areas free of roofs, ceilings, and higher floor slabs", async () => {
  const levels = new Set();
  for (const width of [8, 12]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const build = await CastleGenerator.generate({ position: { x: -width / 2, z: -width / 2, width, depth: width, elevation: 3 },
        doors: [{ side, offset: width / 2 - 1, width: 2 }], style: "twin-tower", seed: "rooms" });
      const layout = new CastleResidentialLayout(build);
      const room = build.layout.roomPlan.rooms.leisure;
      assert.ok(room);
      assert.ok((room.maxX - room.minX) * (room.maxZ - room.minZ) >= 9, "terrace reserves at least nine square metres");
      levels.add(room.level);
      if (room.level === 1) {
        const floor = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, room.floorY - layout.origin.y - 0.125);
        assert.ok(build.metadata.collision.cameraBlocks.some((block) => Math.abs(block.x - floor.x) <= block.halfX &&
          Math.abs(block.z - floor.z) <= block.halfZ && Math.abs(block.y - floor.y) <= block.halfY),
        "the terrace keeps its masonry floor after removing timber" );
      }
      if (room.level === 1 && build.layout.roomPlan.rooms.upperGallery) {
        const edge = layout.toWorld((room.minX + room.maxX) / 2, room.minZ - 0.125, room.floorY - layout.origin.y + 1.75);
        assert.equal(build.metadata.collision.cameraBlocks.some((block) => Math.abs(block.x - edge.x) < block.halfX &&
          Math.abs(block.z - edge.z) < block.halfZ && Math.abs(block.y - edge.y) < block.halfY), false,
        "the terrace frontage stays below eye level" );
      }
      const overlaps = (bounds) => bounds.maxX > room.minX + 0.01 && bounds.minX < room.maxX - 0.01 &&
        bounds.maxZ > room.minZ + 0.01 && bounds.minZ < room.maxZ - 0.01;
      for (const roof of build.geometry.decorations.roofs) {
        if (roof.y <= room.floorY) continue;
        const center = layout.toLocal(roof.x, roof.z);
        assert.ok(build.layout.roomPlan.placedRooms.some((covered) => covered.id !== "leisure" &&
          center.x >= covered.minX && center.x <= covered.maxX && center.z >= covered.minZ && center.z <= covered.maxZ),
        "roofs belong to occupied rooms, not unused terrace" );
        const angle = roof.yaw * Math.PI / 180;
        const corners = [-1, 1].flatMap((x) => [-1, 1].map((z) => layout.toLocal(
          roof.x + Math.cos(angle) * x * roof.width / 2 + Math.sin(angle) * z * roof.depth / 2,
          roof.z - Math.sin(angle) * x * roof.width / 2 + Math.cos(angle) * z * roof.depth / 2)));
        assert.equal(overlaps({ minX: Math.min(...corners.map((p) => p.x)), maxX: Math.max(...corners.map((p) => p.x)),
          minZ: Math.min(...corners.map((p) => p.z)), maxZ: Math.max(...corners.map((p) => p.z)) }), false, `${side}: leisure has no roof`);
      }
      for (const area of layout.walkableAreas.filter((area) => area.floorY > room.floorY)) {
        assert.equal(overlaps(area), false, `${side}: leisure has no upper slab`);
      }
      for (const block of build.metadata.collision.cameraBlocks) {
        if (block.y <= room.floorY + 1.5) continue;
        const p = layout.toLocal(block.x, block.z);
        assert.equal(p.x > room.minX + 0.2 && p.x < room.maxX - 0.2 && p.z > room.minZ + 0.2 && p.z < room.maxZ - 0.2,
          false, `${side}: leisure has no masonry ceiling`);
      }
    }
  }
  assert.ok([...levels].every((level) => level === 0 || level === 1));
});

it("places exactly one large courtyard or continuous upper terrace in every seed castle", async () => {
  const { readFile } = await import("node:fs/promises");
  const map = JSON.parse(await readFile(new URL("../../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
  for (const castle of map.objects.filter((object) => object.object === "Castle")) {
    const build = await CastleGenerator.generate(castle);
    const leisure = build.layout.roomPlan.placedRooms.filter((room) => room.id === "leisure");
    assert.equal(leisure.length, 1, castle.seed);
    if (leisure[0].level === 0) {
      assert.ok((leisure[0].maxX - leisure[0].minX) * (leisure[0].maxZ - leisure[0].minZ) >= 18, castle.seed);
      continue;
    }
    const layout = new CastleResidentialLayout(build);
    const x = (leisure[0].minX + leisure[0].maxX) / 2;
    const z = (leisure[0].minZ + leisure[0].maxZ) / 2;
    assert.ok(build.metadata.collision.cameraBlocks.some((block) => {
      const local = layout.toLocal(block.x, block.z);
      return Math.abs(local.x - x) <= block.halfX + 0.125 && Math.abs(local.z - z) <= block.halfZ + 0.125 &&
        Math.abs(block.y + block.halfY - leisure[0].floorY) < 1e-6;
    }), `${castle.seed}: leisure terrace has a masonry floor`);
  }
});

it("requires a courtyard twice the terrace minimum and never requests both floors", async () => {
  const { LeisureRoomGenerator } = await import("../../../../../src/game/generator/castle/rooms/LeisureRoomGenerator.js");
  const terrace = new LeisureRoomGenerator();
  const courtyard = new LeisureRoomGenerator({ courtyard: true });
  assert.equal(courtyard.min.x * courtyard.min.y, 2 * terrace.min.x * terrace.min.y);
  assert.deepEqual(terrace.levels, [1]);
  assert.deepEqual(courtyard.levels, [0]);
  assert.equal(courtyard.id, terrace.id);
});

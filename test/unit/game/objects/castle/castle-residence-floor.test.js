import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

const source = readFileSync(new URL("../../../../../src/game/objects/castle/CastleResidence.js", import.meta.url), "utf8");
const method = source.slice(source.indexOf("  #furnishRooms("), source.indexOf("  #buildExterior("))
  .replace("#furnishRooms", "furnishRooms").replaceAll("this.#", "this.");
const Harness = new Function(`
const bookcaseUrl = "books", mapUrl = "map", lanternUrl = "lantern", crestUrl = "crest",
  floorUrl = "floor", rugUrl = "rug";
const findCastleMapMount = () => null;
const Bookshelf = { name: "Bookshelf", addVisual: () => ({}) };
${source.slice(source.indexOf("function subtractFloorArea"))}
return class { ${method} };`)();

it("covers every bedroom floor patch outside the exact reserved stair opening", async () => {
  class Entity extends pc.Entity {
    addComponent() {}
  }
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    for (const offset of [2, 3, 4]) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 8, depth: 8, elevation: 3 },
        doors: [{ side, offset, width: 2 }], style: "twin-tower" });
      const harness = new Harness();
      harness.layout = new CastleResidentialLayout(plan);
      harness.entity = new Entity();
      harness.solids = [];
      harness.furnishRooms({ ...pc, Entity }, { instantiate: () => new Entity() }, plan);
      const room = harness.layout.rooms.bedroom;
      const center = harness.layout.toLocal(harness.layout.stairs.center.x, harness.layout.stairs.center.z);
      const radius = harness.layout.stairs.radius;
      const panels = harness.entity.children.filter(({ name }) => name === "Bedroom oak parquet panel");
      let area = 0;
      for (const panel of panels) {
        const position = panel.getLocalPosition();
        const size = panel.getLocalScale();
        area += size.x * size.z;
        const overlapX = Math.min(position.x + size.x / 2, center.x + radius) -
          Math.max(position.x - size.x / 2, center.x - radius);
        const overlapZ = Math.min(position.z + size.z / 2, center.z + radius) -
          Math.max(position.z - size.z / 2, center.z - radius);
        assert.ok(overlapX < 1e-6 || overlapZ < 1e-6, "floor must leave shaft open");
      }
      const cutWidth = Math.max(0, Math.min(room.maxX, center.x + radius) - Math.max(room.minX, center.x - radius));
      const cutDepth = Math.max(0, Math.min(room.maxZ, center.z + radius) - Math.max(room.minZ, center.z - radius));
      const expected = (room.maxX - room.minX) * (room.maxZ - room.minZ) - cutWidth * cutDepth;
      assert.ok(Math.abs(area - expected) < 1e-5, `${side}/${offset}: parquet coverage ${area}, expected ${expected}`);
    }
  }
});

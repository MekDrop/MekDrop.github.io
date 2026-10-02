import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

const source = readFileSync(new URL("../../../../../src/game/objects/servant/Servant.js", import.meta.url), "utf8").replace(/^import[^\n]+\r?\n/gm, "");
const Servant = new Function("servantModelUrl", "TerraceActor", `${source.replace("export class", "class")}\nreturn Servant;`)("servant.glb", class {
  entity = new pc.Entity(); pose() {}
});
it("places the idle servant clear of the service table and bed in every orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
      doors: [{ side, offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
    const layout = new CastleResidentialLayout(plan);
    const servant = new Servant({ pc, definition: { id: "servant" }, runtime: { objects: { getAll: () => [] } } });
    servant.bindResidence({ pc, modelLibrary: {}, residence: { layout, canEnterBasement: () => true } });
    const position = servant.entity.getLocalPosition();
    const standing = layout.toLocal(position.x, position.z);
    for (const item of plan.layout.roomPlan.furniture.filter((item) => item.roomId === "service")) {
      const gap = Math.hypot(Math.max(0, Math.abs(standing.x - item.x) - item.width * item.scale / 2),
        Math.max(0, Math.abs(standing.z - item.z) - item.depth * item.scale / 2));
      assert.ok(gap >= 0.44999, `${side} servant clears ${item.role}`);
    }
  }
});

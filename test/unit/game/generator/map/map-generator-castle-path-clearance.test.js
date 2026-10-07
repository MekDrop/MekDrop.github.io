import assert from "node:assert/strict";
import { it } from "node:test";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";

it("keeps map 5 mirrored walls inside the reservation and connects every gate to the door", async () => {
  const map = await MapGenerator.generate({ mapName: "5" });
  const plan = map.objects.find(({ object }) => object === "Castle").buildPlan;
  const { position, doors } = plan.input;
  const authored = await CastleBasePlanGenerator.generate({ seed: "5", unitMetres: 1 });
  const doorZ = position.z + doors[0].offset + doors[0].width / 2;
  for (const building of authored.buildings) {
    const minZ = doorZ + building.minX - authored.entrance.center;
    const maxZ = doorZ + building.maxX - authored.entrance.center;
    assert.ok(minZ >= position.z && maxZ <= position.z + position.depth,
      "mirrored walls remain inside the reserved foundation, clear of surrounding roads");
  }
  assert.equal(map.paths.length, map.entries.length);
  for (const path of map.paths) {
    const end = path.route.at(-1);
    assert.ok(end, "every gate has a connected route");
    assert.ok(Math.abs(end.col - (map.cols - 1) / 2 - position.x) <= 0.5);
    assert.ok(Math.abs(end.row - (map.rows - 1) / 2 - doorZ) < 0.000001,
      "the complete two-lane approach ends at the main door");
  }
});

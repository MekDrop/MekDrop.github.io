import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { CastleTableMapObjects } from "../../../../../../src/game/objects/castle-props/table/CastleTableMapObjects.js";

it("publishes writing desks with unchanged placement and castle-aligned collision in every orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    const buildPlan = await CastleGenerator.generate({
      position: {
        x: -4,
        z: -4,
        width: 8,
        depth: 8,
        elevation: 3,
      },
      doors: [{
        side,
        offset: 3,
        width: 2,
      }],
      style: "twin-tower",
    });
    const plan = buildPlan.metadata.runtime.residential;
    const reference = plan.furniture.find(item => item.role === "servantBed");
    for (const role of ["workDesk", "kitchenTable"]) {
      plan.furniture.push({
        ...reference,
        id: role,
        role,
        width: 0.9,
        depth: 0.55,
        scale: 0.8,
        rotation: 90,
      });
    }
    const layout = new CastleResidentialLayout(buildPlan);
    const placements = layout.placements.filter(item => ["workDesk", "kitchenTable"].includes(item.role));
    const standalone = {
      id: "independent-table",
      object: "Table",
    };
    const map = {
      cols: 42,
      rows: 42,
      objects: [standalone, {
        id: "castle",
        object: "Castle",
        buildPlan,
      }],
    };
    CastleTableMapObjects.prepareMap(map);
    const tables = map.objects.filter(item => item.castleTable);
    assert.ok(tables.length > 0);

    assert.equal(tables.length, placements.length);
    for (let index = 0; index < tables.length; index++) {
      const table = tables[index];
      const placement = placements[index];
      assert.deepEqual(table.position, placement.position);
      assert.equal(table.rotation, placement.yaw);
      assert.equal(table.collisionRotation, layout.yaw);
      assert.equal(table.scale, placement.scale.x);
      assert.equal(table.deskContents, true);
      assert.equal(table.variant, "writingDesk");
      assert.deepEqual(table.footprint, placement.footprint);
    }
    const snapshot = structuredClone(tables);
    CastleTableMapObjects.prepareMap(map);
    assert.deepEqual(map.objects.filter(item => item.castleTable), snapshot);
    assert.ok(map.objects.includes(standalone));
  }
});

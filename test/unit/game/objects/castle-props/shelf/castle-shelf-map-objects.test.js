import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { CastleShelfMapObjects } from "../../../../../../src/game/objects/castle-props/shelf/CastleShelfMapObjects.js";

it("publishes storage shelves with unchanged placement and castle-aligned collision in every orientation", async () => {
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
    const layout = new CastleResidentialLayout(buildPlan);
    const placements = layout.placements.filter(item => ["storageShelf"].includes(item.role));
    const standalone = {
      id: "independent-bed",
      object: "Shelf",
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
    CastleShelfMapObjects.prepareMap(map);
    const beds = map.objects.filter(item => item.castleShelf && item.variant === "storage");
    assert.ok(beds.length > 0);

    assert.equal(beds.length, placements.length);
    for (let index = 0; index < beds.length; index++) {
      const bed = beds[index];
      const placement = placements[index];
      assert.deepEqual(bed.position, placement.position);
      assert.equal(bed.rotation, placement.yaw);
      assert.equal(bed.collisionRotation, layout.yaw);
      assert.equal(bed.scale, placement.scale.y);
      assert.deepEqual(bed.footprint, placement.footprint);
    }
    const snapshot = structuredClone(beds);
    CastleShelfMapObjects.prepareMap(map);
    assert.deepEqual(map.objects.filter(item => item.castleShelf && item.variant === "storage"), snapshot);
    assert.ok(map.objects.includes(standalone));
  }
});

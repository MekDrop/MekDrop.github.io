import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { CastleWardrobeMapObjects } from "../../../../../../src/game/objects/castle-props/wardrobe/CastleWardrobeMapObjects.js";

it("publishes wardrobes with unchanged placement and castle-aligned collision in every orientation", async () => {
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
    // Include a rotated wardrobe even when this compact generated plan has none.
    const plan = buildPlan.metadata.runtime.residential;
    const servant = plan.furniture.find(item => item.role === "servantBed");
    plan.furniture.push({
      ...servant,
      id: "rotated-wardrobe",
      role: "wardrobe",
      width: 0.46,
      depth: 0.65,
      rotation: 90,
    });
    const layout = new CastleResidentialLayout(buildPlan);
    const placements = layout.placements.filter(item => item.role === "wardrobe");
    const standalone = {
      id: "independent-bed",
      object: "Wardrobe",
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
    CastleWardrobeMapObjects.prepareMap(map);
    const beds = map.objects.filter(item => item.castleWardrobe);
    assert.ok(beds.length > 0);
    assert.equal(beds.length, placements.length);
    for (let index = 0; index < beds.length; index++) {
      const bed = beds[index];
      const placement = placements[index];
      assert.deepEqual(bed.position, placement.position);
      assert.equal(bed.rotation, placement.yaw);
      assert.equal(bed.collisionRotation, layout.yaw);
      assert.equal(bed.scale * bed.stretch.y, placement.scale.y);
      assert.deepEqual(bed.footprint, placement.footprint);
    }
    const snapshot = structuredClone(beds);
    CastleWardrobeMapObjects.prepareMap(map);
    assert.deepEqual(map.objects.filter(item => item.castleWardrobe), snapshot);
    assert.ok(map.objects.includes(standalone));
  }
});

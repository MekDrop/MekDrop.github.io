import assert from "node:assert/strict";
import { test } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleLanternMapObjects } from "../../../../../src/game/objects/castle/CastleLanternMapObjects.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

test("entrance lantern placements preserve mounting transforms across facings and repeated preparation", async () => {
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [0, 1]) {
      const buildPlan = await CastleGenerator.generate({
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
      const authored = {
        id: "independent-lantern",
        object: "TableLantern",
      };
      const map = {
        cols: 64,
        rows: 64,
        objects: [{
          id: "castle",
          object: "Castle",
          buildPlan,
        }, authored],
      };
      CastleLanternMapObjects.prepareMap(map);
      const first = structuredClone(map.objects);
      CastleLanternMapObjects.prepareMap(map);
      assert.deepEqual(map.objects, first);
      assert.ok(map.objects.includes(authored));
      const lanterns = map.objects.filter(item => item.castleLantern && item.object === "Lantern" && item.type === "entrance");
      assert.equal(lanterns.length, 2);
      const layout = new CastleResidentialLayout(buildPlan);
      const entrance = buildPlan.metadata.runtime.residential.openings.find(item => item.exteriorEntrance);
      for (const [index, flank] of [-1, 1].entries()) {
        const lantern = lanterns[index];
        assert.deepEqual(lantern.position, layout.toWorld(flank * (entrance.width / 2 + 0.54), -0.48, 1.3));
        assert.equal(lantern.rotation, layout.yaw + 180);
        assert.equal(lantern.scale, 1.6);
        assert.equal(lantern.stretch.x, 0.8633);
        assert.deepEqual(lantern.tile, {
          col: 18,
          row: 24,
        });
        assert.equal(lantern.lighting.range, 2.2);
      }
      const audience = map.objects.filter(item => item.castleLantern && item.lighting?.flicker);
      assert.equal(audience.length, 2);
      assert.ok(audience.every(item => item.object === "Lantern" && item.type === "wall" && item.scale === 0.85 && item.position.y === 3.85));
    }
  }
});

test("castles without residential metadata still publish audience lanterns", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const buildPlan = await CastleGenerator.generate({
      position: {
        x: -4,
        z: -4,
        width: 8,
        depth: 8,
        elevation: 4,
      },
      doors: [{
        side,
        offset: 3,
        width: 2,
      }],
      style: "courtyard-keep",
    });
    delete buildPlan.metadata.runtime.residential;
    const map = {
      cols: 16,
      rows: 16,
      objects: [{
        id: "keep",
        object: "Castle",
        buildPlan,
      }],
    };
    CastleLanternMapObjects.prepareMap(map);
    const lanterns = map.objects.filter(item => item.castleLantern);
    assert.equal(lanterns.length, 2);
    assert.ok(lanterns.every(item => Object.values(item.position).every(Number.isFinite)));
  }
});

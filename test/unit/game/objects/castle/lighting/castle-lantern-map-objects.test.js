import assert from "node:assert/strict";
import { test } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleLanternMapObjects } from "../../../../../../src/game/objects/castle/lighting/CastleLanternMapObjects.js";
import { LanternWallPlacement } from "../../../../../../src/game/objects/castle/lighting/LanternWallPlacement.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";

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
        object: "Lantern",
        "type":"table",
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
        const expected = layout.toWorld(flank * (entrance.width / 2 + 0.54), -0.25 - 0.1284 * 1.6 * 0.8633, 1.3);
        assert.ok(Math.hypot(lantern.position.x - expected.x, lantern.position.z - expected.z) < 1e-6);
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

test("floating authored lanterns mount to the nearest wall and face outward", () => {
  const lantern = {
    object: "Lantern",
    type: "entrance",
    position: {
      x: 3,
      y: 1,
      z: 0,
    },
    rotation: 180,
  };
  const portable = {
    ...structuredClone(lantern),
    type: "table",
  };
  const map = {
    objects: [{
      object: "Castle",
      buildPlan: {
        geometry: {
          boxes: [{
            x: 0,
            y: 1.5,
            z: 0,
            sx: 0.5,
            sy: 3,
            sz: 4,
            yaw: 0,
          }],
        },
      },
    }, lantern, portable],
  };
  LanternWallPlacement.prepareMap(map);
  assert.equal(lantern.position.x, 0.25 + 0.1284);
  assert.equal(lantern.position.z, 0.1284);
  assert.equal(lantern.rotation, 90);
  assert.equal(portable.position.x, 3);
  const first = structuredClone(map);
  LanternWallPlacement.prepareMap(map);
  assert.deepEqual(map, first);
});

test("entrance backplates move fully inward from wall edges on every facing", () => {
  for (const yaw of [0, 90, 180, 270]) {
    const angle = yaw * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const lantern = {
      object: "Lantern",
      type: "entrance",
      position: {
        x: cos * 1.02 + sin * -0.5,
        y: 1,
        z: -sin * 1.02 + cos * -0.5,
      },
      rotation: yaw + 180,
    };
    const map = {
      objects: [{
        object: "Castle",
        buildPlan: {
          geometry: {
            boxes: [{
              x: 0,
              y: 2,
              z: 0,
              sx: 2,
              sy: 4,
              sz: 0.5,
              yaw,
            }],
          },
        },
      }, lantern],
    };
    LanternWallPlacement.prepareMap(map);
    const lateral = lantern.position.x * cos - lantern.position.z * sin;
    const forward = lantern.position.x * sin + lantern.position.z * cos;
    assert.ok(Math.abs(lateral - (1 - 0.034 - 0.005)) < 1e-6);
    assert.ok(Math.abs(forward + 0.25 + 0.1284) < 1e-6);
    assert.equal(map.objects.length, 2);
  }
});

test("backplate support spans masonry courses but rejects an air gap within the plate", () => {
  for (const gap of [0, 0.02]) {
    const lantern = {
      object: "Lantern",
      type: "wall",
      position: {
        x: 0,
        y: 1,
        z: -0.5,
      },
      rotation: 180,
    };
    const boxes = [1.075, 1.242].map(y => ({
      x: 0,
      y,
      z: 0,
      sx: 0.12,
      sy: 0.167 - gap,
      sz: 0.01,
      yaw: 0,
    }));
    const map = {
      objects: [{
        object: "Castle",
        buildPlan: {
          geometry: {
            boxes,
          },
        },
      }, lantern],
    };
    LanternWallPlacement.prepareMap(map);
    assert.equal(map.objects.includes(lantern), gap === 0,
      "never leave a bracket hanging across missing masonry");
  }
});

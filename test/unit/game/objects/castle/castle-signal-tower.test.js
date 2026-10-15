import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { CastleSignalTowerLayout } from "../../../../../src/game/objects/castle/CastleSignalTowerLayout.js";
import { CastleSignalTowerMapObjects } from "../../../../../src/game/objects/castle/CastleSignalTowerMapObjects.js";
import { CastleWindowLayout } from "../../../../../src/game/objects/castle/CastleWindowLayout.js";

it("keeps signal props supported and clear of mirrored hatches for every orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [4, 5]) {
      const buildPlan = await CastleGenerator.generate({
        position: {
          x: -12,
          z: -12,
          width: 24,
          depth: 24,
          elevation: 3,
        },
        doors: [{
          side,
          offset: 11,
          width: 2,
        }],
        seed,
        basePlanId: "castle-compact-service-wing",
      });
      const station = CastleSignalTowerLayout.describe(buildPlan);
      assert.ok(station);
      const plan = buildPlan.metadata.runtime.residential;
      const layout = new CastleResidentialLayout(buildPlan);
      const point = layout.toLocal(station.bell.position.x, station.bell.position.z);
      const room = plan.placedRooms.find(room => room.id === "watchtower");
      assert.equal(station.bell.position.y, plan.roofAccess.top.y);
      assert.ok(Math.hypot(station.bell.position.x - station.flag.position.x,
        station.bell.position.z - station.flag.position.z) > 1.5, "flag stays clear of the bell frame");
      assert.ok(point.x - 0.703 > room.minX && point.x + 0.703 < room.maxX);
      assert.ok(point.z - 0.241 > room.minZ && point.z + 0.241 < room.maxZ);
      const hole = plan.roofAccess.hole;
      assert.ok(point.x + 0.703 < hole.minX || point.x - 0.703 > hole.maxX ||
        point.z + 0.241 < hole.minZ || point.z - 0.241 > hole.maxZ);
      const map = {
        cols: 64,
        rows: 64,
        objects: [{
          id: "castle",
          object: "Castle",
          seed,
          buildPlan,
        }],
      };
      CastleSignalTowerMapObjects.prepareMap(map);
      CastleSignalTowerMapObjects.prepareMap(map);
      assert.equal(map.objects.filter(item => item.object === "SignalBell").length, 1);
      assert.equal(map.objects.filter(item => item.object === "Flag").length, 1);
      assert.equal(buildPlan.geometry.decorations.banners.filter(item => item.signalTower).length, 1);
      const windows = new CastleWindowLayout(buildPlan).windows.filter(window => window.width <= 0.25);
      assert.ok(windows.length >= 12);
      assert.ok(windows.every(window => window.role === "slit"));
    }
  }
});

it("leaves castles without crown access alone", () => {
  assert.equal(CastleSignalTowerLayout.describe({ metadata: { runtime: { residential: {} } } }), null);
});

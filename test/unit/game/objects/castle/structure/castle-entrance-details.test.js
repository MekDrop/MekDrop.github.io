import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";
import { CastleLanternMapObjects } from "../../../../../../src/game/objects/castle/lighting/CastleLanternMapObjects.js";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith("/LanternFire.js")) {
      return {
        url: "data:text/javascript,export class LanternFire { static add() {} }",
        shortCircuit: true,
      };
    }
    if (specifier.endsWith(".glb?url")) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { CastleEntranceDetails } = await import("../../../../../../src/game/objects/castle/structure/CastleEntranceDetails.js");
hooks.deregister();

test("attached tower exterior trim never projects into the castle interior", async () => {
  class DetailEntity extends pc.Entity {
    addComponent() {}
  }
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [4, 5]) {
      const plan = await CastleGenerator.generate({
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
      const parent = new pc.Entity();
      CastleEntranceDetails.add({
        ...pc,
        Entity: DetailEntity,
      }, { instantiate: () => new DetailEntity() }, parent, plan, null);
      const residential = plan.metadata.runtime.residential;
      const angle = residential.origin.yaw * Math.PI / 180;
      const details = parent.children.filter(node => /corner trim|support band/.test(node.name));
      assert.ok(details.length > 0, "exposed facade details remain");
      for (const detail of details) {
        const p = detail.getLocalPosition(), scale = detail.getLocalScale();
        const dx = p.x - residential.origin.x, dz = p.z - residential.origin.z;
        const x = dx * Math.cos(angle) - dz * Math.sin(angle), z = dx * Math.sin(angle) + dz * Math.cos(angle);
        assert.ok(!residential.buildings.some(building =>
          Math.min(x + scale.x / 2, building.maxX) > Math.max(x - scale.x / 2, building.minX) + 1e-6 &&
          Math.min(z + scale.z / 2, building.maxZ) > Math.max(z - scale.z / 2, building.minZ) + 1e-6 &&
          Math.min(p.y + scale.y / 2, building.floorY + building.height) > Math.max(p.y - scale.y / 2, building.floorY) + 1e-6), `${seed}/${side}: trim intersects an interior volume`);
      }
      parent.destroy();
    }
  }
});

test("entrance lanterns flank the fixed doorway on every facing and mirrored seed", async () => {
  class LightEntity extends pc.Entity {
    addComponent(type, options) {
      this.light = options;
    }
  }
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [0, 1]) {
      const plan = await CastleGenerator.generate({
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
      const parent = new pc.Entity();
      CastleEntranceDetails.add({
        ...pc,
        Entity: LightEntity,
      }, { instantiate: () => new LightEntity() }, parent, plan, null);
      const map = {
        cols: 64,
        rows: 64,
        objects: [{
          id: "castle",
          object: "Castle",
          buildPlan: plan,
        }],
      };
      CastleLanternMapObjects.prepareMap(map);
      const lanterns = map.objects.filter(item => item.castleLantern && item.object === "Lantern" && item.type === "entrance");
      const lights = lanterns.filter(item => item.lighting);
      const trim = parent.children.filter(node => node.name === "Castle ground floor corner trim");
      assert.equal(lanterns.length, 2);
      assert.equal(lights.length, 2);
      assert.equal(trim.length, 48);
      assert.ok(trim.every(node => node.getLocalScale().x >= 0.34 && node.getLocalScale().z >= 0.34));
      const bands = parent.children.filter(node => node.name === "Castle terrace support band");
      assert.ok(bands.length > 0);
      const terraceY = plan.metadata.runtime.residential.origin.y + plan.metadata.runtime.residential.floorHeight;
      for (const band of bands) {
        const topY = band.getLocalPosition().y + band.getLocalScale().y / 2;
        assert.ok(Math.abs(terraceY - topY - 0.002) < 1e-6,
          "decorative bands stay below the masonry floor plane on every facing");
      }
      const planters = parent.children.filter(node => node.name === "Castle terrace boxwood planter");
      assert.equal(planters.length, 4);
      const { origin } = plan.metadata.runtime.residential;
      const angle = origin.yaw * Math.PI / 180;
      for (const detail of [...trim, ...bands]) {
        const position = detail.getLocalPosition();
        const scale = detail.getLocalScale();
        const dx = position.x - origin.x;
        const dz = position.z - origin.z;
        const x = dx * Math.cos(angle) - dz * Math.sin(angle);
        const z = dx * Math.sin(angle) + dz * Math.cos(angle);
        for (const building of plan.metadata.runtime.residential.buildings) {
          if (building.floorY > origin.y) {
            continue;
          }
          const overlapX = Math.min(x + scale.x / 2, building.maxX) - Math.max(x - scale.x / 2, building.minX);
          const overlapZ = Math.min(z + scale.z / 2, building.maxZ) - Math.max(z - scale.z / 2, building.minZ);
          assert.ok(overlapX <= -0.003 || overlapZ <= -0.003,
            "exterior trim faces stay buried beyond the interior wall plane");
        }
      }
      for (const planter of planters) {
        const position = planter.getLocalPosition();
        const dx = position.x - origin.x;
        const dz = position.z - origin.z;
        const x = dx * Math.cos(angle) - dz * Math.sin(angle);
        const z = dx * Math.sin(angle) + dz * Math.cos(angle);
        assert.ok(plan.metadata.runtime.residential.spaces.some(space => space.kind === "terrace" &&
          position.y === space.floorY && x > space.minX + 0.33 && x < space.maxX - 0.33 &&
          z > space.minZ + 0.33 && z < space.maxZ - 0.33));
      }
      const entrance = plan.metadata.runtime.residential.openings.find(item => item.exteriorEntrance);
      for (const lantern of lanterns) {
        const position = lantern.position;
        const dx = position.x - origin.x;
        const dz = position.z - origin.z;
        assert.ok(Math.abs(Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) - (entrance.width / 2 + 0.54)) < 1e-6);
        assert.ok(Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle) + 0.25 + 0.1284 * 1.6 * 0.8633) < 1e-6);
        assert.equal(position.y, origin.y + 1.3);
      }
      parent.destroy();
    }
  }
});

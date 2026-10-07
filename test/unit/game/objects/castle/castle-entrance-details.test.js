import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".glb?url")) {
      return { url: `data:text/javascript,export default ${JSON.stringify(specifier)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { CastleEntranceDetails } = await import("../../../../../src/game/objects/castle/CastleEntranceDetails.js");
hooks.deregister();

test("entrance lanterns flank the fixed doorway on every facing and mirrored seed", async () => {
  class LightEntity extends pc.Entity {
    addComponent(type, options) { this.light = options; }
  }
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    for (const seed of [0, 1]) {
      const plan = await CastleGenerator.generate({ position: { x: -14, z: -8, width: 28, depth: 16, elevation: 3 },
        doors: [{ side, offset: 13, width: 2 }], seed });
      const parent = new pc.Entity();
      CastleEntranceDetails.add({ ...pc, Entity: LightEntity }, { instantiate: () => new LightEntity() }, parent, plan, null);
      const lanterns = parent.children.filter(node => node.name === "Castle entrance wall lantern");
      const lights = parent.children.filter(node => node.name === "Castle entrance lantern light");
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
      for (const lantern of lanterns) {
        const position = lantern.getLocalPosition();
        const dx = position.x - origin.x;
        const dz = position.z - origin.z;
        assert.ok(Math.abs(Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) - 1.65) < 1e-6);
        assert.ok(Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle) + 0.35) < 1e-6);
        assert.equal(position.y, origin.y + 1.3);
      }
      parent.destroy();
    }
  }
});

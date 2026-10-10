import assert from "node:assert/strict";
import test from "node:test";
import { KitchenChimneyLayout } from "../../../../../src/game/objects/castle/KitchenChimneyLayout.js";

test("chimneys meet the pitched roof after castle rotation and retain room floor offsets", () => {
  const plan = {
    metadata: { runtime: { residential: { floorHeight: 3, spaces: [], walkableAreas: [] } } },
    geometry: { decorations: { roofs: [{ x: 0, y: 9, z: 0, yaw: 0, width: 8, depth: 4, height: 2 }] } },
  };
  const position = { x: 1.972, y: 3, z: 0.2073 };
  assert.equal(KitchenChimneyLayout.height(plan, { x: 2, z: 0, floorY: 3 }, position, 0), 7.12);
  plan.geometry.decorations.roofs[0].yaw = 90;
  assert.equal(KitchenChimneyLayout.height(plan, { x: 2, z: 0, floorY: 3 }, { x: 0.2073, y: 3, z: -1.972 }, 90), 7.12);
  assert.equal(KitchenChimneyLayout.height(plan, { x: 2, z: 0, floorY: 0 }, { x: 0.2073, y: 0, z: -1.972 }, 90), 10.12);
});

test("flat ceilings use the highest covering floor while unrelated roofs are excluded", () => {
  const plan = {
    metadata: { runtime: { residential: { floorHeight: 3,
      spaces: [{ minX: 0, maxX: 4, minZ: 0, maxZ: 4, floorY: 3, height: 2.5 }],
      walkableAreas: [{ minX: 0, maxX: 4, minZ: 0, maxZ: 4, floorY: 8 }] } } },
    geometry: { decorations: { roofs: [{ x: 100, y: 20, z: 100, yaw: 0, width: 8, depth: 4, height: 2 }] } },
  };
  assert.equal(KitchenChimneyLayout.height(plan, { x: 2, z: 2, floorY: 3 }, { x: 2, y: 3, z: 2 }, 0), 5.12);
  plan.metadata.runtime.residential.walkableAreas = [];
  assert.equal(KitchenChimneyLayout.height(plan, { x: 2, z: 2, floorY: 3 }, { x: 2, y: 3, z: 2 }, 0), 2.62);
});

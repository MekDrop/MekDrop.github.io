import assert from "node:assert/strict";
import test from "node:test";
import { FireplaceGenerator } from "../../../../../../src/game/objects/castle-props/fireplace/FireplaceGenerator.js";

test("chimneys meet the pitched roof after castle rotation and retain room floor offsets", () => {
  const plan = {
    metadata: {
      runtime: {
        residential: {
          floorHeight: 3,
          spaces: [],
          walkableAreas: [],
        },
      },
    },
    geometry: {
      decorations: {
        roofs: [{
          x: 0,
          y: 9,
          z: 0,
          yaw: 0,
          width: 8,
          depth: 4,
          height: 2,
        }],
      },
    },
  };
  const position = {
    x: 1.972,
    y: 3,
    z: 0.2073,
  };
  assert.equal(FireplaceGenerator.height(plan, {
    x: 2,
    z: 0,
    floorY: 3,
  }, position, 0), 8.72);
  plan.geometry.decorations.roofs[0].yaw = 90;
  assert.equal(FireplaceGenerator.height(plan, {
    x: 2,
    z: 0,
    floorY: 3,
  }, {
    x: 0.2073,
    y: 3,
    z: -1.972,
  }, 90), 8.72);
  assert.equal(FireplaceGenerator.height(plan, {
    x: 2,
    z: 0,
    floorY: 0,
  }, {
    x: 0.2073,
    y: 0,
    z: -1.972,
  }, 90), 11.72);
});

test("flat ceilings use the highest covering floor while unrelated roofs are excluded", () => {
  const plan = {
    metadata: {
      runtime: {
        residential: {
          floorHeight: 3,
          spaces: [{
            minX: 0,
            maxX: 4,
            minZ: 0,
            maxZ: 4,
            floorY: 3,
            height: 2.5,
          }],
          walkableAreas: [{
            minX: 0,
            maxX: 4,
            minZ: 0,
            maxZ: 4,
            floorY: 8,
          }],
        },
      },
    },
    geometry: {
      decorations: {
        roofs: [{
          x: 100,
          y: 20,
          z: 100,
          yaw: 0,
          width: 8,
          depth: 4,
          height: 2,
        }],
      },
    },
  };
  assert.equal(FireplaceGenerator.height(plan, {
    x: 2,
    z: 2,
    floorY: 3,
  }, {
    x: 2,
    y: 3,
    z: 2,
  }, 0), 5.72);
  plan.metadata.runtime.residential.walkableAreas = [];
  assert.ok(Math.abs(FireplaceGenerator.height(plan, {
    x: 2,
    z: 2,
    floorY: 3,
  }, {
    x: 2,
    y: 3,
    z: 2,
  }, 0) - 3.22) < 1e-6);
});


test("terraces terminate the chimney three masonry courses above their exposed floor", () => {
  const plan = {
    metadata: {
      runtime: {
        residential: {
          floorHeight: 3,
          spaces: [{
            minX: 0,
            maxX: 4,
            minZ: 0,
            maxZ: 4,
            floorY: 3,
            height: 3,
            kind: "room",
          },
          {
            minX: 0,
            maxX: 4,
            minZ: 0,
            maxZ: 4,
            floorY: 6,
            height: 3,
            kind: "terrace",
          }],
          walkableAreas: [],
        },
      },
    },
    geometry: { decorations: { roofs: [] } },
  };
  assert.equal(FireplaceGenerator.height(plan, {
    x: 2,
    z: 2,
    floorY: 0,
  }, {
    x: 2,
    y: 0,
    z: 2,
  }, 0), 6.72);
  assert.equal(FireplaceGenerator.hasTerraceTerminal(plan, {
    x: 2,
    z: 2,
    floorY: 0,
  }, {
    x: 2,
    y: 0,
    z: 2,
  }, 6.72), true);
  assert.equal(FireplaceGenerator.hasTerraceTerminal(plan, {
    x: 2,
    z: 2,
    floorY: 0,
  }, {
    x: 2,
    y: 0,
    z: 2,
  }, 10), false);
});


test("generation preserves the published fireplace and owns both chimney fields", () => {
  const buildPlan = {
    metadata: {
      runtime: {
        residential: {
          spaces: [{
            kind: "terrace",
            minX: -2,
            maxX: 2,
            minZ: -2,
            maxZ: 2,
            floorY: 6,
            height: 3,
          }],
        },
      },
    },
  };
  const item = {
    x: 0,
    z: 0,
    floorY: 0,
  };
  const definition = {
    id: "hearth",
    object: "Fireplace",
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    rotation: 90,
    scale: 0.8,
    sourceCastleId: "castle",
  };
  const generated = FireplaceGenerator.generate(buildPlan, item, definition);
  assert.deepEqual(generated, {
    ...definition,
    chimneyHeight: 6.72,
    chimneyMetalTerminal: true,
  });
  assert.equal(Object.hasOwn(definition, "chimneyHeight"), false);
});

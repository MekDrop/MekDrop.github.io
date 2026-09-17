import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GrassSurface } from "../../src/game/objects/ground-cover/GrassSurface.js";
import {
  resetAmbientWindSpeed,
  setAmbientWindSpeed,
} from "../../src/game/objects/shared/AmbientWind.js";

function createSubject(
  zoom,
  getSurfaceContacts = () => [],
  getImpressionContacts = () => [],
) {
  const parameters = new Map();
  const material = {
    setParameter(name, value) {
      parameters.set(name, value);
    },
  };
  let update = null;
  let render = null;
  const app = {
    on(event, callback) {
      if (event === "update") {
        update = callback;
      } else {
        assert.equal(event, "prerender");
        render = callback;
      }
      return { off() {} };
    },
  };
  const grass = new GrassSurface({
    app,
    terrainMaterials: [material],
    zoom,
    getSurfaceContacts,
    getImpressionContacts,
  });
  return { grass, parameters, update: (deltaTime) => { update(deltaTime); render(); } };
}

describe("grass canopy wind", () => {
  it("keeps ambient grass movement restrained at fitted zoom", () => {
    const { parameters, update } = createSubject(1);

    update(1 / 60);

    assert.ok(parameters.get("uGrassAmbientMotion") > 0);
    assert.ok(parameters.get("uGrassAmbientMotion") < 0.5);
  });

  it("shows the full wind response once the camera is zoomed in", () => {
    const { parameters, update } = createSubject(1.1);

    update(1 / 60);

    assert.equal(parameters.get("uGrassAmbientMotion"), 1);
  });

  it("reduces ambient wind immediately at fitted zoom", () => {
    const { grass, parameters, update } = createSubject(1.1);
    update(1 / 60);

    grass.zoom = 1;

    assert.ok(parameters.get("uGrassAmbientMotion") < 0.5);
  });

  it("responds much more strongly to an occasional large gust", () => {
    const { parameters, update } = createSubject(1.1);
    update(0);
    const ordinaryStrength = parameters.get("uGrassWindStrength");

    for (let index = 0; index < 242; index += 1) {
      update(0.1);
    }

    assert.ok(ordinaryStrength < 0.15);
    assert.ok(parameters.get("uGrassWindStrength") > 0.85);
    const direction = parameters.get("uGrassWindDirection");
    assert.ok(Math.abs(Math.hypot(...direction) - 1) < 0.000001);
  });

  it("keeps increasing grass movement above natural gust speeds", () => {
    setAmbientWindSpeed(10);
    try {
      const { parameters, update } = createSubject(1.1);

      update(1 / 60);

      assert.ok(parameters.get("uGrassWindStrength") > 4);
    } finally {
      resetAmbientWindSpeed();
    }
  });

  it("sends distributed surface loads to the grass shader", () => {
    const contact = {
      x: 1,
      y: 2,
      z: 3,
      radius: 0.36,
      compression: 0.025,
      slopeX: 0.08,
      slopeZ: -0.02,
    };
    const { parameters, update } = createSubject(1, () => [contact]);

    update(1 / 60);

    const surfaces = parameters.get("uGrassSurfaces[0]");
    const loads = parameters.get("uGrassSurfaceLoads[0]");
    [1, 2, 3, 0.36].forEach((value, index) => {
      assert.ok(Math.abs(surfaces[index] - value) < 0.000001);
    });
    [0.025, 0.08, -0.02, 1].forEach((value, index) => {
      assert.ok(Math.abs(loads[index] - value) < 0.000001);
    });
  });

  it("sends source-agnostic moving impressions to the grass shader", () => {
    const contact = {
      id: "physics-body",
      x: 1,
      y: 2,
      z: 3,
      radius: 0.2,
      strength: 0.6,
    };
    const { parameters, update } = createSubject(
      1,
      () => [],
      () => [contact],
    );

    update(1 / 60);

    const impressions = parameters.get("uGrassImpressions[0]");
    const shapes = parameters.get("uGrassImpressionShapes[0]");
    [1, 2, 3, 0.6].forEach((value, index) => {
      assert.ok(Math.abs(impressions[index] - value) < 0.000001);
    });
    assert.ok(Math.abs(shapes[2] - 0.2) < 0.000001);
    assert.ok(Math.abs(shapes[3] - 0.2) < 0.000001);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GrassSurface } from "../../src/game/objects/ground-cover/GrassSurface.js";

function createSubject(zoom) {
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
  });
  return { grass, parameters, update: (deltaTime) => { update(deltaTime); render(); } };
}

describe("grass canopy wind", () => {
  it("keeps ambient grass still at fitted zoom", () => {
    const { parameters, update } = createSubject(1);

    update(1 / 60);

    assert.equal(parameters.get("uGrassAmbientMotion"), 0);
  });

  it("allows gentle wind once the camera is zoomed in", () => {
    const { parameters, update } = createSubject(1.1);

    update(1 / 60);

    assert.ok(parameters.get("uGrassAmbientMotion") > 0);
  });

  it("stops ambient wind immediately at fitted zoom", () => {
    const { grass, parameters, update } = createSubject(1.1);
    update(1 / 60);

    grass.zoom = 1;

    assert.equal(parameters.get("uGrassAmbientMotion"), 0);
  });
});

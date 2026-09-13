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
  const app = {
    on(event, callback) {
      assert.equal(event, "update");
      update = callback;
      return { off() {} };
    },
  };
  const grass = new GrassSurface({
    app,
    terrainMaterials: [material],
    zoom,
  });
  return { grass, parameters, update: (deltaTime) => update(deltaTime) };
}

describe("grass surface view motion", () => {
  it("keeps procedural grass still while rotating at fitted zoom", () => {
    const { grass, parameters, update } = createSubject(1);

    grass.applyViewInteraction(18, 0);
    update(1 / 60);

    assert.equal(parameters.get("uGrassMotionInfluence"), 0);
  });

  it("retains view brushing once the camera is zoomed in", () => {
    const { grass, parameters, update } = createSubject(1.1);

    grass.applyViewInteraction(18, 0);
    update(1 / 60);

    assert.ok(parameters.get("uGrassMotionInfluence") > 0);
  });

  it("clears an active view brush immediately at fitted zoom", () => {
    const { grass, parameters, update } = createSubject(1.1);
    grass.applyViewInteraction(18, 0);
    update(1 / 60);

    grass.zoom = 1;

    assert.equal(parameters.get("uGrassMotionInfluence"), 0);
  });
});

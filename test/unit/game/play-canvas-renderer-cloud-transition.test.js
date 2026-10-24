import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../../../src/game/PlayCanvasRenderer.js", import.meta.url), "utf8");
const clearStart = source.indexOf("  #clearScene() {");
const clearEnd = source.indexOf("\n  }", clearStart) + "\n  }".length;
const buildStart = source.indexOf("  #buildClouds() {");
const buildEnd = source.indexOf("\n  }", buildStart) + "\n  }".length;
const frameStart = source.indexOf("  #updateFrame = (");
const frameEnd = source.indexOf("\n  };", frameStart) + "\n  };".length;
const methods = [
  source.slice(clearStart, clearEnd),
  source.slice(buildStart, buildEnd),
  source.slice(frameStart, frameEnd),
].join("\n").replaceAll("#", "_");
const Driver = new Function("SCENE_OBJECT_TYPE", `return class { ${methods} }`)({});

for (const replacing of [false, true]) {
  for (const destroyed of [false, true]) {
    it(`cleans up clouds correctly with replacement=${replacing}, destroyed=${destroyed}`, () => {
      const driver = new Driver();
      const service = {
        clear: () => {},
        destroyType: () => {},
      };
      driver._decorations = service;
      driver._sceneObjects = service;
      driver._collisionWorld = service;
      driver._vertexBuffers = [];
      driver._setInteractionTarget = () => {};
      driver._replacingScene = replacing;
      driver._destroyed = destroyed;
      let cleanups = 0;
      const clouds = { destroy: () => cleanups++ };
      driver._cloudField = clouds;

      driver._clearScene();

      const retained = replacing && !destroyed;
      assert.equal(cleanups, retained ? 0 : 1);
      assert.equal(driver._cloudField, retained ? clouds : null);
      if (retained) {
        assert.doesNotThrow(() => driver._buildClouds());
        assert.equal(driver._cloudField, clouds);
      }
    });
  }
}

it("keeps cloud motion running during replacement without updating incomplete scenery", () => {
  const driver = new Driver();
  driver._replacingScene = true;
  const updates = [];
  driver._cloudField = { update: (deltaTime) => updates.push(deltaTime) };
  driver._updateRuntimeSystems = () => assert.fail("scenery is still being built");
  driver._updateFrame(0.016);
  assert.deepEqual(updates, [0.016]);
});

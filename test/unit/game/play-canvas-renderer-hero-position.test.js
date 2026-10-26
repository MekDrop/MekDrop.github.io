import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(
  new URL("../../../src/game/PlayCanvasRenderer.js", import.meta.url),
  "utf8",
);
const start = source.indexOf("  #handleHeroPositionChange = (");
const end = source.indexOf("\n  };", start) + "\n  };".length;
const method = source.slice(start, end).replaceAll("#", "_");
const Driver = new Function("SCENE_OBJECT_TYPE", `
  const HERO_CAMERA_CENTER_HEIGHT = 0.85;
  const HERO_VIEWPORT_MARGIN = 80;
  return class { ${method} }
`)({
  HERO: "hero",
});

it("does not follow or schedule visibility rotation for a dying hero", () => {
  const driver = new Driver();
  const position = {
    x: 1,
    y: 0.5,
    z: 3,
  };
  driver._sceneObjects = {
    getOne: () => ({
      isDying: true,
      isRespawning: false,
      entity: { getPosition: () => position },
    }),
  };
  driver._camera = {
    manuallyMoved: true,
    camera: {
      worldToScreen: () => ({
        x: 320,
        y: 240,
      }),
    },
  };
  driver._pc = { Vec3: class {} };
  driver.canvas = {
    clientWidth: 640,
    clientHeight: 480,
  };
  driver._updateCastlesForHero = () => {};
  driver._updateInteractionTarget = () => {};
  let scheduled = false;
  driver._heroVisibility = {
    schedule: () => {
      scheduled = true;
    },
  };
  driver._handleHeroPositionChange(position);
  assert.equal(scheduled, false);
});

it("ignores position callbacks when the hero is no longer registered", () => {
  const driver = new Driver();
  driver._sceneObjects = { getOne: () => null };
  // No camera or scene services remain available during teardown.
  assert.doesNotThrow(() => driver._handleHeroPositionChange({
    x: 1,
    y: 2,
    z: 3,
  }));
});

it("still updates scene interactions for a registered hero with a locked camera", () => {
  const driver = new Driver();
  const calls = [];
  const position = {
    x: 1,
    y: 2,
    z: 3,
  };
  driver._sceneObjects = { getOne: () => ({ movementState: "walking" }) };
  driver._camera = { orbitPivot: "previous" };
  driver._cameraLocked = true;
  driver._updateCastlesForHero = (value) => calls.push(["castles", value]);
  driver._groundCover = {
    applyHeroInteraction: (value, state) => calls.push(["ground", value, state]),
  };
  driver._buriedTreasure = {
    applyHeroPosition: (value) => calls.push(["treasure", value]),
  };
  driver._updateInteractionTarget = (value) => calls.push(["target", value]);
  driver._handleHeroPositionChange(position);
  assert.equal(driver._camera.orbitPivot, null);
  assert.deepEqual(calls, [
    ["castles", position],
    ["ground", position, "walking"],
    ["treasure", position],
    ["target", position],
  ]);
});

it("ignores retired hero movement while the replacement scene is being built", () => {
  const driver = new Driver();
  driver._sceneObjects = { getOne: () => ({}) };
  driver._replacingScene = true;
  assert.doesNotThrow(() => driver._handleHeroPositionChange({
    x: 1,
    y: 2,
    z: 3,
  }));
});

const cameraStart = source.indexOf("  #updateCamera(panOrigin = null, preserveFocus = false) {");
const cameraEnd = source.indexOf("\n  }", cameraStart) + "\n  }".length;
const cameraMethod = source.slice(cameraStart, cameraEnd).replaceAll("#", "_");
const CameraDriver = new Function(`return class { ${cameraMethod} }`)();

it("keeps the rendered camera unchanged until scene replacement finishes", () => {
  const driver = new CameraDriver();
  driver._camera = {};
  driver._mapData = {};
  driver._replacingScene = true;
  assert.doesNotThrow(() => driver._updateCamera());
  assert.deepEqual(driver._camera, {});
});

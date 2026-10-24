import assert from "node:assert/strict";
import { it } from "node:test";
import { Camera, Entity, EventHandler, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from "playcanvas";
import { DirectionalShadowCoverage } from "../../../../src/game/rendering/DirectionalShadowCoverage.js";

/**
 * @returns {{app: EventHandler, camera: Camera, light: {entity: Entity, shadowDistance: number}}}
 */
function fixture() {
  const app = new EventHandler();
  const camera = new Camera();
  camera.projection = PROJECTION_ORTHOGRAPHIC;
  camera.farClip = 250;
  const light = {
    entity: new Entity("Sunlight"),
    shadowDistance: 150,
  };
  new DirectionalShadowCoverage(app, light, camera);

  return {
    app,
    camera,
    light,
  };
}

it("covers visible receivers beyond the former 150-unit cutoff without moving the camera", () => {
  const { app, camera, light } = fixture();
  const castleDepth = Math.hypot(160, 112);
  assert.ok(castleDepth > 150 && castleDepth < camera.farClip);
  assert.ok(light.shadowDistance >= castleDepth);
  assert.equal(light.shadowDistance, camera.farClip);
  camera.farClip = 500;
  app.fire("prerender");
  assert.equal(light.shadowDistance, 500);
});

it("restores full coverage after first-person mode while respecting its short range", () => {
  const { app, camera, light } = fixture();
  camera.projection = PROJECTION_PERSPECTIVE;
  app.fire("prerender");
  assert.equal(light.shadowDistance, 24);
  camera.farClip = 12;
  app.fire("prerender");
  assert.equal(light.shadowDistance, 12);
  camera.projection = PROJECTION_ORTHOGRAPHIC;
  camera.farClip = 250;
  app.fire("prerender");
  assert.equal(light.shadowDistance, 250);
});

it("unsubscribes when the sunlight is destroyed", () => {
  const { app, camera, light } = fixture();
  light.entity.destroy();
  camera.farClip = 500;
  app.fire("prerender");
  assert.equal(light.shadowDistance, 250);
});

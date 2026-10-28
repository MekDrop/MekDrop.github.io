import assert from "node:assert/strict";
import { it } from "node:test";
import { EventHandler } from "playcanvas";
import { DetachedShaderWarmup } from "../../../../src/game/rendering/DetachedShaderWarmup.js";

/**
 * @returns {{app: EventHandler, pc: object, root: object, passes: number[], restored: object}}
 */
function fixture() {
  const app = new EventHandler();
  const passes = [];
  const restored = {};
  const camera = { shaderParams: {} };
  const layer = {
    getLightHash: () => 42,
    splitLights: [[{ castShadows: true }]],
  };
  app.graphicsDevice = {
    shader: restored,
    setShader: (shader) => {
      app.graphicsDevice.shader = shader;
    },
    activateShader: () => true,
  };
  app.scene = { layers: { getLayerById: () => layer } };
  app.renderer = { shadowRenderer: { getShadowPass: () => 7 } };
  app.root = {
    findComponents: () => [{
      enabled: true,
      entity: { enabled: true },
      layers: [0],
      camera,
    }],
  };
  const root = {
    findComponents: () => [{
      castShadows: true,
      meshInstances: [{
        castShadow: true,
        material: {},
        getShaderInstance: (pass) => {
          passes.push(pass);

          return { shader: {} };
        },
      }],
    }],
  };

  return {
    app,
    pc: {
      LAYERID_WORLD: 0,
      SHADER_FORWARD: 0,
    },
    root,
    passes,
    restored,
  };
}

it("prepares forward and shadow variants once without attaching or drawing the template", () => {
  const { app, pc, root, passes, restored } = fixture();
  const warmup = new DetachedShaderWarmup(pc, app, root);
  assert.deepEqual(passes, []);
  app.fire("postrender");
  app.fire("postrender");
  assert.deepEqual(passes, [0, 7]);
  assert.equal(app.graphicsDevice.shader, restored);
  warmup.destroy();
});

it("cancels pending preparation when its owner is destroyed", () => {
  const { app, pc, root, passes } = fixture();
  const warmup = new DetachedShaderWarmup(pc, app, root);
  warmup.destroy();
  app.fire("postrender");
  assert.deepEqual(passes, []);
});

it("retries unavailable scene state and restores the shader after failed activation", () => {
  const { app, pc, root, passes, restored } = fixture();
  const renderer = app.renderer;
  app.renderer = null;
  new DetachedShaderWarmup(pc, app, root);
  app.fire("postrender");
  assert.deepEqual(passes, []);
  app.renderer = renderer;
  app.graphicsDevice.activateShader = () => false;
  for (let attempt = 0; attempt < 6; attempt++) {
    app.fire("postrender");
  }
  assert.equal(passes.length, 3);
  assert.equal(app.graphicsDevice.shader, restored);
});

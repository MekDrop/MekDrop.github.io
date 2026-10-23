import assert from "node:assert/strict";
import { test } from "node:test";
import * as engine from "playcanvas";
import { CastleSwapEffect } from "../../../../../src/game/objects/castle/CastleSwapEffect.js";

test("transformation covers its footprint and releases emitters and texture", () => {
  let textureDestroyed = false;
  const textures = [];
  class Texture {
    constructor() {
      this.pixels = new Uint8Array(32 * 32 * 4);
      textures.push(this);
    }
    lock() {
      return this.pixels;
    }
    unlock() {}
    destroy() {
      textureDestroyed = true;
    }
  }
  class Entity extends engine.Entity {
    addComponent(type, config) {
      assert.equal(type, "particlesystem");
      this.particlesystem = {
        ...config,
        stopped: false,
        stop: () => {
          this.particlesystem.stopped = true;
        },
      };
    }
  }
  const root = new engine.Entity();
  const app = Object.assign(new engine.EventHandler(), {
    root,
    graphicsDevice: {},
  });
  const effect = new CastleSwapEffect({
    ...engine,
    Texture,
    Entity,
  }, app, {
    x: 2,
    z: -8,
    width: 12,
    depth: 20,
    elevation: 3,
  }, {
    findComponents: () => [{
      meshInstances: [{
        aabb: new engine.BoundingBox(new engine.Vec3(9, 7, 4), new engine.Vec3(7, 3, 11)),
      }],
    }],
  });
  const entity = root.children[0];
  assert.deepEqual(entity.getPosition().toArray(), [9, 7, 4]);
  assert.equal(entity.children.length, 2);
  for (const child of entity.children) {
    const emitter = child.particlesystem;
    assert.equal(emitter.loop, true);
    assert.equal(emitter.preWarm, false);
    assert.equal(emitter.localVelocityGraph.curves.length, 3);
    assert.ok(emitter.emitterExtents.x >= 14);
    assert.ok(emitter.emitterExtents.z >= 22);
  }
  assert.equal(textures[0].pixels[3], 0);
  const center = (16 * 32 + 16) * 4 + 3;
  assert.equal(textures[0].pixels[center], 0);
  app.fire("update", 0.1);
  const earlyAlpha = textures[0].pixels[center];
  assert.ok(earlyAlpha > 0 && earlyAlpha < 150);
  for (let frame = 0; frame < 11; frame += 1) {
    app.fire("update", 0.1);
  }
  const peakAlpha = textures[0].pixels[center];
  assert.ok(peakAlpha > 200);
  assert.equal(entity.children[0].particlesystem.numParticles, 500);
  effect.finish();
  assert.ok(entity.children.every((child) => child.particlesystem.stopped));
  app.fire("update", 0.1);
  assert.ok(textures[0].pixels[center] > 0 && textures[0].pixels[center] < peakAlpha);
  for (let frame = 0; frame < 14; frame += 1) {
    app.fire("update", 0.1);
  }
  assert.equal(textures[0].pixels[center], 0);
  effect.destroy();
  assert.equal(app.hasEvent("update"), false);
  assert.equal(root.children.length, 0);
  assert.equal(textureDestroyed, true);
});

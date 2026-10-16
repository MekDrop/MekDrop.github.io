import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { FireEffect } from "../../../../../src/game/objects/fire/FireEffect.js";

class EffectEntity extends pc.Entity {
  /**
   * @param {string} type
   * @param {Record<string, number>} options
   */
  addComponent(type, options) {
    this[type] = options;
  }
}

test("shared effect retains flame, sparks, calibrated glow and phase, then releases its listener", () => {
  const app = new pc.EventHandler();
  const texture = {};
  const effect = new FireEffect({
    pc: {
      ...pc,
      Entity: EffectEntity,
    },
    app,
    particleTexture: texture,
  });
  effect.add({
    x: 2,
    y: 3,
    z: 4,
    scale: 0.25,
    intensity: 0.7,
    phase: 1.713,
  });
  const root = effect.entity.children[0];
  assert.deepEqual(root.getLocalPosition().toArray(), [2, 3, 4]);
  const flame = root.findByName("Rising fire particles");
  const sparks = root.findByName("Fire sparks");
  assert.equal(flame.particlesystem.numParticles, 36);
  assert.equal(sparks.particlesystem.numParticles, 7);
  assert.equal(flame.particlesystem.colorMap, texture);
  assert.equal(sparks.particlesystem.localSpace, true);
  const glow = root.findByName("Fire glow");
  assert.equal(glow.light.range, 3);
  app.fire("update", 0.25);
  assert.equal(glow.light.intensity,
    (0.78 + Math.sin(0.25 * 11.1 + 1.713) * 0.18 + Math.sin(0.25 * 4.7 + 1.713 * 1.31) * 0.1) * 0.7);
  effect.destroy();
  assert.equal(app.hasEvent("update"), false);
  effect.destroy();
});

test("glow-only effects allocate no particles and direct parent destruction detaches updates", () => {
  const app = new pc.EventHandler();
  const effect = new FireEffect({
    pc: {
      ...pc,
      Entity: EffectEntity,
    },
    app,
  });
  effect.add({
    x: 0,
    y: 0,
    z: 0,
    flame: false,
  });
  assert.equal(effect.entity.children[0].children.length, 1);
  const parent = new EffectEntity("owner");
  parent.addChild(effect.entity);
  parent.destroy();
  assert.equal(app.hasEvent("update"), false);
  app.fire("update", 1);
  effect.destroy();
});

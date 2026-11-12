import assert from "node:assert/strict";
import { test } from "node:test";
import * as engine from "playcanvas";
import { CastleSwapEffect } from "../../../../../src/game/objects/castle/CastleSwapEffect.js";

test("switch audio sustains through long generation and fades with the mist", () => {
  const played = [];
  const stopped = [];
  class Entity extends engine.Entity {
    addComponent(type, config) {
      if (type === "sound") {
        const slots = {};
        this.sound = {
          enabled: true,
          addSlot: (name, options) => {
            slots[name] = options;
          },
          slot: (name) => slots[name],
          play: (name) => played.push(name),
          stop: (name) => stopped.push(name),
        };
      } else {
        this.particlesystem = {
          ...config,
          stop: () => {},
        };
      }
    }
  }
  class Texture {
    pixels = new Uint8Array(32 * 32 * 4);
    lock() {
      return this.pixels;
    }
    unlock() {}
    destroy() {}
  }
  const root = new engine.Entity();
  root._enabledInHierarchy = true;
  const app = Object.assign(new engine.EventHandler(), {
    root,
    graphicsDevice: {},
    soundManager: { resume: () => {} },
  });
  const effect = new CastleSwapEffect({
    ...engine,
    Entity,
    Texture,
  }, app, {
    x: 0,
    z: 0,
    width: 10,
    depth: 10,
  }, null, { get: () => ({ id: 1 }) });
  const sound = root.children[0].sound;
  assert.equal(sound.slot("mist").loop, true);
  assert.equal(sound.slot("mist").volume, 0);
  assert.deepEqual(played, ["mist"]);
  for (let frame = 0; frame < 450; frame++) {
    app.fire("update", 0.1);
  }
  assert.equal(sound.slot("mist").volume, 0.38);
  assert.deepEqual(stopped, [], "no fixed timeout can silence a slow generation");
  effect.finish();
  effect.finish();
  assert.deepEqual(played, ["mist", "reveal"]);
  app.fire("update", 0.1);
  assert.ok(sound.slot("mist").volume > 0 && sound.slot("mist").volume < 0.38);
  for (let frame = 0; frame < 14; frame++) {
    app.fire("update", 0.1);
  }
  assert.equal(sound.slot("mist").volume, 0);
  assert.ok(stopped.includes("mist"));
  effect.destroy();
  assert.equal(app.hasEvent("update"), false);
});

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
  assert.deepEqual(entity.getPosition().toArray(), [9, 6.5, 4]);
  assert.equal(entity.children.length, 2);
  for (const child of entity.children) {
    const emitter = child.particlesystem;
    assert.equal(emitter.loop, true);
    assert.equal(emitter.preWarm, false);
    assert.equal(emitter.localVelocityGraph.curves.length, 3);
    assert.ok(emitter.emitterExtents.x >= 14);
    assert.ok(emitter.emitterExtents.z >= 22);
    assert.equal(emitter.emitterExtents.y, 0.24, "fog originates in a shallow ground bed");
    assert.equal(emitter.localSpace, false, "translated castles sort in world camera coordinates");
    assert.equal(emitter.depthWrite, false, "soft particles do not occlude other geometry");
    assert.equal(child.getLocalPosition().y, -3.38);
    assert.ok(Math.abs(child.getPosition().y - 3.12) < 1e-6, "particles originate at the old castle's ground level");
    assert.ok(emitter.localVelocityGraph.curves[1].value(0) < emitter.localVelocityGraph.curves[1].value(0.3), "fog first appears low before accelerating upward");
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
  assert.ok(entity.children[0].particlesystem.alphaGraph.value(0) > 0, "mist is visible as it leaves the ground");
  assert.ok(entity.children[0].particlesystem.depthSoftening > 0, "mist fades where it intersects walls");
  assert.equal(entity.children[1].particlesystem.depthSoftening, 0, "small additive sparks do not need soft intersections");
  assert.equal(entity.children[0].particlesystem.sort, engine.PARTICLESORT_DISTANCE);
  assert.equal(entity.children[1].particlesystem.sort, engine.PARTICLESORT_NONE);
  effect.finish();
  const releasePosition = entity.getLocalPosition().clone();
  assert.ok(entity.children.every((child) => child.particlesystem.stopped));
  app.fire("update", 0.1);
  assert.ok(textures[0].pixels[center] > 0 && textures[0].pixels[center] < peakAlpha);
  assert.deepEqual(entity.getLocalPosition().toArray(), releasePosition.toArray());
  for (const child of entity.children) {
    const wind = child.particlesystem.velocityGraph;
    assert.ok(wind.curves.every((curve) => curve.value(0) > 0), "live particles flow away in world space");
    assert.equal(child.particlesystem.velocityGraph2, wind, "release wind applies to all surviving particles");
  }
  for (let frame = 0; frame < 8; frame += 1) {
    app.fire("update", 0.1);
  }
  assert.equal(textures[0].pixels[center], 0, "release clears in under one second");
  for (let frame = 0; frame < 14; frame += 1) {
    app.fire("update", 0.1);
  }
  assert.equal(textures[0].pixels[center], 0);
  effect.destroy();
  assert.equal(app.hasEvent("update"), false);
  assert.equal(root.children.length, 0);
  assert.equal(textureDestroyed, true);
});

test("expands mist for larger incoming masonry and rotated roofs", () => {
  class Texture {
    pixels = new Uint8Array(32 * 32 * 4);
    lock() {
      return this.pixels;
    }
    unlock() {}
    destroy() {}
  }
  class Entity extends engine.Entity {
    addComponent(_type, config) {
      this.particlesystem = {
        ...config,
        stop: () => {},
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
  }, app,
  {
    x: 0,
    z: 0,
    width: 10,
    depth: 10,
    elevation: 2,
  });
  const plan = {
    geometry: {
      boxes: [{
        x: 14,
        y: 10,
        z: 5,
        sx: 2,
        sy: 4,
        sz: 2,
      }],
      decorations: {
        roofs: [{
          x: 14,
          y: 12,
          z: 5,
          width: 6,
          depth: 8,
          height: 3,
          yaw: 45,
        }],
      },
    },
  };
  assert.equal(effect.includePlan(plan), true);
  const effectRoot = root.children[0];
  const mist = effectRoot.children[0].particlesystem;
  const center = effectRoot.getPosition();
  assert.ok(center.x + mist.emitterExtents.x / 2 >= 19, "rotated roof is inside the mist");
  assert.ok(center.z - mist.emitterExtents.z / 2 <= 0);
  const groundY = center.y + effectRoot.children[0].getLocalPosition().y - 0.12;
  assert.ok(mist.localVelocityGraph.curves[1].value(0.55) >= 2 * (15 - groundY));
  assert.equal(effect.includePlan(plan), false, "unchanged plans do not restart expansion");
  effect.destroy();
});

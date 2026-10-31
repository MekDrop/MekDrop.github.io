import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchSurface } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSurface.js";

it("queues local transfer without replacing the older silhouette or restarting its impact", () => {
  const surface = Object.create(LatchSurface.prototype);
  surface.owner = { pc };
  surface.splash = { entity: new pc.Entity() };
  surface.inverse = new pc.Mat4();
  surface.positions = new Float32Array([-0.5, 0, 0.1, 0.5, 0, 0.1, 0, 1, 0.1]);
  surface.start = new Float32Array(surface.positions);
  surface.sourceVolume = 0.07;
  surface.age = 8;
  surface.deposits = [];
  surface.metrics = {};
  const incoming = {
    splash: { entity: new pc.Entity() },
    inverse: new pc.Mat4(),
    sourceVolume: 0.06,
  };
  incoming.splash.entity.setPosition(0.6, 0.1, 0);
  const positions = [...surface.positions], start = surface.start;
  surface.absorb(incoming);
  assert.deepEqual([...surface.positions], positions);
  assert.equal(surface.start, start);
  assert.equal(surface.age, 8);
  assert.equal(surface.sourceVolume, 0.07);
  assert.equal(surface.deposits.length, 1);
  assert.equal(surface.deposits[0].volume, 0.06);
  assert.equal(surface.deposits[0].progress, 0);
  assert.ok(surface.deposits[0].center.distance(new pc.Vec3(0.5, 0, 0.1)) < 1e-6);
  assert.equal(incoming.drainage.progress, 0);
});
import { gelVolume } from "../../../../../../src/game/objects/enemies/latch-slug/LatchImpactShape.js";

it("keeps a repeated local deposit bounded and conserves the transferred volume while settling", () => {
  const shape = new pc.SphereGeometry({ radius: 0.3 });
  const basis = shape.positions.map((value, i) => value + (i % 3 === 1 ? 0.8 : i % 3 === 2 ? 0.35 : 0));
  class Entity extends pc.Entity {
    addComponent() {}
  }
  class Mesh {
    setPositions(value) {
      this.positions = [...value];
    }
    setIndices() {}
    setNormals() {}
    update() {}
  }
  const original = {
    mesh: {
      getPositions: out => out.push(...basis),
      getIndices: out => out.push(...shape.indices),
    },
    material: { clone: () => ({}) },
  };
  const create = () => {
    const splash = {
      entity: new pc.Entity(),
      model: { findComponents: () => [{ meshInstances: [original] }] },
    };
    const owner = {
      pc: {
        ...pc,
        Entity,
        Mesh,
        MeshInstance: class {},
      },
      app: { graphicsDevice: {} },
      finishSplatTransition: () => {},
    };
    const surface = new LatchSurface(splash, owner);
    Object.assign(surface, {
      original,
      basis,
      indices: shape.indices,
      targets: [],
      initial: basis,
      start: basis,
      positions: new Float32Array(basis),
      base: new Float32Array(basis.length),
      transform: new pc.Mat4(),
      inverse: new pc.Mat4(),
      normalSign: 1,
      initialVolume: Math.abs(gelVolume(basis, shape.indices)),
      sourceVolume: Math.abs(gelVolume(basis, shape.indices)),
      field: {
        height: () => 0,
        flow: (x, initial, y) => y,
      },
      age: 8,
      metrics: {
        maxRelativeVolumeError: 0,
        frames: 0,
      },
    });
    splash.update = dt => surface.update(dt);
    splash.clear = () => surface.clear();

    return surface;
  };
  const old = create(), incoming = create();
  const total = old.sourceVolume + incoming.sourceVolume;
  old.absorb(incoming);
  for (let i = 0; i < 180; i++) {
    old.update(1 / 60);
    assert.ok(old.positions.every(Number.isFinite));
    for (let j = 2; j < old.positions.length; j += 3) {
      assert.ok(Math.abs(old.positions[j]) < 2, "gel thickness must not turn into a spike");
    }
  }
  assert.ok(Math.abs(old.sourceVolume - total) < 1e-7);
  assert.ok(old.metrics.maxRelativeVolumeError < 1e-5);
});

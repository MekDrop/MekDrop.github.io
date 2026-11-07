import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchSurface } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSurface.js";

it("loses only gel that crosses the floor, never refills drained volume, and finishes only below the threshold", () => {
  class Entity extends pc.Entity {
    addComponent(type, data) {
      this[type] = data;
    }
  }
  class Mesh {
    setPositions() {}
    setIndices() {}
    setNormals() {}
    update() {}
  }
  class MeshInstance {
    constructor(mesh, material) {
      this.mesh = mesh;
      this.material = material;
    }
  }
  const shape = new pc.BoxGeometry();
  const original = {
    mesh: {
      getPositions: out => out.push(...shape.positions),
      getIndices: out => out.push(...shape.indices),
    },
    material: { clone: () => ({}) },
  };
  const splash = {
    entity: new Entity(),
    model: { findComponents: () => [{ meshInstances: [original] }] },
  };
  const surface = new LatchSurface(splash, {
    pc: {
      ...pc,
      Entity,
      Mesh,
      MeshInstance,
    },
    app: { graphicsDevice: {} },
    finishSplatTransition: () => {},
  });
  Object.assign(surface, {
    filmEnabled: false,
    original,
    basis: shape.positions,
    indices: shape.indices,
    start: shape.positions,
    initial: shape.positions,
    base: new Float32Array(shape.positions.length),
    positions: new Float32Array(shape.positions.length),
    targets: [],
    transform: new pc.Mat4(),
    floor: 0,
    field: {
      flow: (x, from, to) => to,
      height: () => 0,
    },
    initialVolume: 1,
    sourceVolume: 1,
    normalSign: 1,
    age: 1,
    metrics: {
      maxRelativeVolumeError: 0,
      frames: 0,
    },
  });
  surface.update(0.1);
  assert.ok(Math.abs(surface.sourceVolume - 0.5) < 1e-6);
  assert.equal(surface.drained, false);
  assert.ok(surface.positions.every((v, i) => i % 3 !== 1 || v >= 0));
  surface.transform.setTranslate(0, -0.25, 0);
  surface.update(0.1);
  assert.ok(Math.abs(surface.sourceVolume - 0.25) < 1e-6);
  surface.transform.setTranslate(0, 0, 0);
  surface.update(0.1);
  assert.ok(Math.abs(surface.sourceVolume - 0.25) < 1e-6, "remaining gel cannot regrow during contour changes");
  surface.transform.setTranslate(0, -1, 0);
  surface.update(0.1);
  assert.equal(surface.drained, true);
  assert.ok(surface.sourceVolume < 1e-9);
});

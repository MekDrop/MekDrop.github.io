import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchSurface } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSurface.js";

function fixture() {
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
    clear() {}
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

  return surface;
}

it("loses only gel that crosses the floor, never refills drained volume, and finishes only below the threshold", () => {
  const surface = fixture();
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

it("measures every outline's deposit from the same body and keeps it visibly wet", () => {
  const bodyShape = new pc.BoxGeometry();
  const body = {
    node: new pc.Entity(),
    mesh: {
      getPositions: out => out.push(...bodyShape.positions),
      getIndices: out => out.push(...bodyShape.indices),
      getVertexStream: () => {},
    },
  };
  for (const width of [0.6, 0.85, 1.2]) {
    const surface = fixture();
    surface.filmEnabled = true;
    const shape = new pc.BoxGeometry();
    const positions = shape.positions.map((value, index) => index % 3 === 0 ? value * width : index % 3 === 2 ? value * 0.1 : value);
    const outline = {
      node: new pc.Entity(),
      mesh: {
        getPositions: out => out.push(...positions),
        getIndices: out => out.push(...shape.indices),
        morph: { targets: [] },
      },
    };
    surface.owner.getImpactMeshes = () => [body];
    surface.splash.variation = { profile: { node: "outline" } };
    surface.splash.model.findByName = () => ({ render: { meshInstances: [outline] } });
    const frame = new pc.Entity();
    frame.setPosition(0, -2, 0);
    surface.bind({
      entity: frame,
      getSurfaceMeshInstances: () => [outline],
    }, -1);
    surface.update(0.2);

    assert.ok(Math.abs(surface.initialVolume - 0.35) < 1e-8, "outline choice cannot change the captured body's deposited mass");
    assert.ok(surface.renderIndices.length > 0, "a live deposit must produce visible triangles");
    assert.ok(surface.sourceVolume > 0);
  }
});

it("hands a folding impact to bounded film before signed-volume cancellation creates a spike", () => {
  for (const normalSign of [-1, 1]) {
    for (const age of [0.088, 0.089]) {
      const surface = fixture();
      surface.filmEnabled = true;
      surface.floor = -2;
      surface.normalSign = normalSign;
      surface.start = Float32Array.from(surface.basis, (value, index) => index % 3 === 2 ? 0.25 - value : value);
      surface.transform.setScale(1, 1, normalSign);
      surface.initialVolume = 0.1;
      surface.sourceVolume = 0.04;
      surface.age = age;

      surface.update(0.001);

      assert.ok(surface.film, "nearly cancelling geometry must not receive an unbounded depth correction");
      assert.ok(Math.abs(surface.sourceVolume - 0.04) < 1e-8, "the handoff retains only the remaining mass");
      assert.ok(Math.max(...surface.film.heights) <= 0.12 + 1e-8);
      assert.ok(surface.positions.every(Number.isFinite));
      assert.equal(surface.drained, false);
    }
  }
});

it("keeps the contact-centred patch when a folded impact projects outside the leaf", () => {
  const surface = fixture();
  surface.filmEnabled = true;
  surface.floor = -2;
  surface.start = Float32Array.from(surface.basis, (value, index) => index % 3 === 0 ? value + 6 : index % 3 === 2 ? .25 - value : value);
  surface.field.contains = (x, y) => Math.abs(x) < .6 && Math.abs(y) < .6;
  surface.initialVolume = .1;
  surface.sourceVolume = .04;
  surface.age = .088;
  surface.update(.001);
  assert.ok(surface.film);
  assert.equal(surface.drained, false);
  assert.ok(Math.abs(surface.sourceVolume - .04) < 1e-8);
  assert.ok(surface.renderIndices.length > 0);
  assert.ok(surface.film.minX < 0, "fallback uses the actual impact footprint, not the airborne body's off-door projection");
});

it("keeps the contact footprint when a folding body's projection only partly overlaps the leaf", () => {
  const surface = fixture();
  surface.filmEnabled = true;
  surface.floor = -2;
  surface.start = Float32Array.from(surface.basis, (value, index) => index % 3 === 0 ? value + 1 : index % 3 === 2 ? 0.25 - value : value);
  surface.field.contains = (x, y) => Math.abs(x) < 0.6 && Math.abs(y) < 0.6;
  surface.initialVolume = 0.1;
  surface.sourceVolume = 0.04;
  surface.age = 0.088;
  surface.update(0.001);
  assert.ok(surface.film);
  assert.ok(surface.film.minX < -1,
    "a surviving off-centre slice must not replace the full contact-centred outline");
  assert.ok(Math.abs(surface.sourceVolume - 0.04) < 1e-8);
});

it("masonry wetting rejects grazing floor hits and perpendicular jamb sides", () => {
  const surface = fixture();
  surface.original.node = new pc.Entity();
  surface.original.mesh.morph = { targets: [] };
  surface.owner.getImpactMeshes = () => [];
  surface.splash.variation = { profile: { node: "outline" } };
  surface.splash.model.findByName = () => ({ render: { meshInstances: [surface.original] } });
  const ground = {
    entity: { rigidbody: { type: "static" } },
    point: new pc.Vec3(0, 0, 0.8),
    normal: new pc.Vec3(0, 1, 0),
  };
  const jamb = {
    entity: { rigidbody: { type: "static" } },
    point: new pc.Vec3(0, 0, 0.6),
    normal: new pc.Vec3(1, 0, 0),
  };
  const wall = {
    entity: { rigidbody: { type: "static" } },
    point: new pc.Vec3(0, 0, 0.1),
    normal: new pc.Vec3(0, 0, 1),
  };
  const overlap = {
    entity: { rigidbody: { type: "static" } },
    point: new pc.Vec3(0, 0, 0.9),
    normal: new pc.Vec3(0, 0, 1),
    hitFraction: 0,
  };
  let hits = [overlap, ground, jamb, wall];
  surface.owner.app.systems = { rigidbody: { raycastAll: () => hits } };
  surface.bind({
    entity: new pc.Entity(),
    getSurfaceMeshInstances: () => [surface.original],
  }, -1);
  assert.ok(Math.abs(surface.field.support(0, 0) - 0.103) < 1e-6);
  hits = [overlap, ground, jamb];
  assert.equal(surface.field.support(0, 0), null);
});

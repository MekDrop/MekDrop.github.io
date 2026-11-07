import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { DoorBreakup } from "../../../../../../src/game/objects/architecture/door/DoorBreakup.js";

test("collapse reuses damaged world-space timber, creates bounded native bodies and releases owned meshes", () => {
  class TestEntity extends pc.Entity {
    addComponent(type, data) {
      this[type] = data;
    }
  }
  class TestMesh {
    setPositions(positions) {
      this.positions = positions;
    }
    setIndices(indices) {
      this.indices = indices;
    }
    setUvs(channel, uvs) {
      this.uvs = uvs;
    }
    setColors(colors) {
      this.colors = colors;
    }
    setNormals() {}
    update() {}
    destroy() {
      this.released = true;
    }
  }
  class TestInstance {
    constructor(mesh, material, node) {
      Object.assign(this, {
        mesh,
        material,
        node,
      });
    }
  }
  const engine = {
    ...pc,
    Entity: TestEntity,
    Mesh: TestMesh,
    MeshInstance: TestInstance,
  };
  const root = new TestEntity();
  const node = new TestEntity();
  node.setPosition(10, 3, -0.4);
  node.setEulerAngles(0, 37, 0);
  const original = [-0.4, 0, -0.04, -0.1, 0, 0, -0.1, 0.5, 0, 0.1, 1.8, 0, 0.4, 1.8, 0, 0.4, 2.2, 0];
  const mesh = {
    getPositions: output => output.push(...original),
    getIndices: output => output.push(0, 1, 2, 3, 4, 5),
    getUvs: (channel, output) => output.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1),
  };
  const material = { name: "Oak" };
  const door = {
    entity: node,
    clearWidth: 1,
    clearHeight: 2.3,
    getSurfaceMeshInstances: () => [{
      mesh,
      node,
      material,
    }],
  };
  const effect = new DoorBreakup(engine, {
    root,
    graphicsDevice: {},
    systems: { rigidbody: {} },
  }, door, null);
  assert.ok(effect.pieces.length > 1 && effect.pieces.length <= 48);
  const inverse = node.getWorldTransform().clone().invert();
  const vertices = effect.pieces.flatMap(piece => {
    assert.equal(piece.rigidbody.type, "dynamic");
    assert.equal(piece.collision.type, "box");
    assert.ok(piece.collision.halfExtents.x <= door.clearWidth / 16 + 1e-6);
    assert.ok(piece.collision.halfExtents.y <= door.clearHeight / 12 + 1e-6);
    assert.ok(Math.abs(piece.getRotation().dot(node.getRotation())) > 0.99999, "native shard boxes follow the doorway orientation");

    return piece.render.meshInstances.flatMap(instance => {
      assert.equal(instance.material, material);
      const points = [];
      for (let i = 0; i < instance.mesh.positions.length; i += 3) {
        const point = piece.getWorldTransform().transformPoint(new pc.Vec3(...instance.mesh.positions.slice(i, i + 3)));
        inverse.transformPoint(point, point);
        points.push(point.x, point.y, point.z);
      }

      return points;
    });
  });
  assert.ok(vertices.length >= original.length);
  assert.ok(vertices.some(value => Math.abs(value + 0.4) < 1e-6));
  assert.ok(vertices.some(value => Math.abs(value + 0.04) < 1e-6), "the carved surface depth is preserved in the falling timber");
  for (const part of effect.meshes) {
    for (let i = 0; i < part.positions.length; i += 9) {
      const a = new pc.Vec3(...part.positions.slice(i, i + 3));
      const b = new pc.Vec3(...part.positions.slice(i + 3, i + 6));
      const c = new pc.Vec3(...part.positions.slice(i + 6, i + 9));
      assert.ok(new pc.Vec3().cross(b.sub(a), c.sub(a)).lengthSq() > 1e-14, "clipped boundary fans contain no degenerate faces");
    }
  }
  const owned = [...effect.meshes];
  const first = effect.pieces[0];
  const initialY = first.getPosition().y;
  effect.update(0.54);
  assert.notEqual(first.rigidbody.enabled, false, "Ammo owns the initial fall");
  effect.update(0.02);
  assert.equal(first.rigidbody.enabled, false);
  assert.equal(first.collision.enabled, false, "sinking debris cannot collide with the bug");
  effect.update(0.3);
  assert.ok(first.getPosition().y < initialY - 0.2, "disabled pieces sink from a fixed captured pose");
  effect.update(0.25);
  assert.equal(effect.pieces.length, 0);
  assert.ok(owned.every(part => part.released));
  assert.equal(root.children.length, 0);
});

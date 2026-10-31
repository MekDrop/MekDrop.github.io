import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchSlimeTrail } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSlimeTrail.js";

class Entity {
  enabled = true;
  addChild() {}
  addComponent() {}
  destroy() {}
}
class Mesh {
  setPositions(value) {
    this.positions = value;
  }
  setNormals() {}
  setColors() {}
  setIndices(value) {
    this.indices = value;
  }
  update() {}
  destroy() {}
}
class Material {
  diffuse = { set: () => {} };
  specular = { set: () => {} };
  update() {}
  destroy() {}
}
function fixture(height) {
  const app = new pc.EventHandler();
  app.root = new Entity();
  app.graphicsDevice = {};
  app.systems = {
    rigidbody: {
      raycastFirst: (start, end) => {
        const y = height(start.x, start.z);

        return y <= start.y && y >= end.y ? {
          point: new pc.Vec3(start.x, y, start.z),
          normal: pc.Vec3.UP,
        } : null;
      },
    },
  };
  const owner = {
    pc: {
      ...pc,
      Entity,
      Mesh,
      StandardMaterial: Material,
      MeshInstance: class {},
    },
    app,
    radius: 0.4,
    position: new pc.Vec3(),
    entity: { rigidbody: { linearVelocity: new pc.Vec3(1, 0, 0) } },
    alive: true,
    gatewayArrival: { active: false },
  };

  return {
    owner,
    trail: new LatchSlimeTrail(owner),
  };
}
it("samples every interpolated tread and breaks the film across a height discontinuity", () => {
  const { owner, trail } = fixture(x => x < 0.15 ? 0 : 0.25);
  trail.update(0.1);
  owner.position.set(0.33, 0.25, 0);
  trail.update(0.1);
  assert.ok(trail.points.some(p => p.position.y < 0.1));
  const upper = trail.points.find(p => p.position.y > 0.2);
  assert.equal(upper.breakBefore, true);
  for (const point of trail.points) {
    assert.ok(Math.abs(point.position.y - (point.position.x < 0.15 ? 0.028 : 0.278)) < 1e-6);
  }
  trail.destroy();
});
it("clips the ribbon width at a ledge instead of laying a film across empty air", () => {
  const { owner, trail } = fixture((x, z) => z < 0 ? -1 : 0);
  owner.position.z = 0.03;
  trail.update(0.1);
  owner.position.x = 0.3;
  trail.update(0.1);
  assert.ok(trail.points.length > 2);
  for (const point of trail.points) {
    assert.ok(point.row.some(vertex => vertex === null));
    for (const vertex of point.row.filter(Boolean)) {
      assert.ok(vertex.z >= 0);
    }
  }
  trail.destroy();
});

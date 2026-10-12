import assert from "node:assert/strict";
import { MapObjectDefinitions } from "../../../../src/game/objects/MapObjectDefinitions.js";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { TerrainPhysicsSurface } from "../../../../src/game/collision/TerrainPhysicsSurface.js";

it("keeps the river open below high bridges while retaining deck collisions", () => {
  const mapData = JSON.parse(readFileSync(new URL("../../../../src/game/maps/tests/river-high-bridge.json", import.meta.url)));
  MapObjectDefinitions.prepare(mapData);
  let mesh;
  const pc = {
    Entity: class {
      tags = { add() {} };
      addComponent(type, value) { this[type] = value; }
      removeComponent(type) { delete this[type]; }
      destroy() {}
    },
    Mesh: class {
      constructor() { mesh = this; }
      setPositions(value) { this.positions = value; }
      setIndices(value) { this.indices = value; }
      update() {}
      destroy() {}
    },
    StandardMaterial: class { update() {} destroy() {} },
    GraphNode: class {}, MeshInstance: class {}, Model: class {},
  };
  const surface = new TerrainPhysicsSurface({ pc, app: { graphicsDevice: {} }, mapData, collisionWorld: null });
  const triangles = new Ammo.btTriangleMesh();
  const vectors = [new Ammo.btVector3(), new Ammo.btVector3(), new Ammo.btVector3()];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    for (let corner = 0; corner < 3; corner += 1) {
      const offset = mesh.indices[index + corner] * 3;
      vectors[corner].setValue(...mesh.positions.slice(offset, offset + 3));
    }
    triangles.addTriangle(...vectors, true);
  }
  const shape = new Ammo.btBvhTriangleMeshShape(triangles, true, true);
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const body = new Ammo.btPairCachingGhostObject();
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  body.setWorldTransform(transform);
  body.setCollisionShape(shape);
  world.addCollisionObject(body, 1, -1);
  const from = new Ammo.btVector3();
  const to = new Ammo.btVector3();
  /**
   * @param {number[]} start
   * @param {number[]} end
   */
  const hits = (start, end) => {
    from.setValue(...start);
    to.setValue(...end);
    const callback = new Ammo.ClosestRayResultCallback(from, to);
    world.rayTest(from, to, callback);
    const hit = callback.hasHit();
    Ammo.destroy(callback);
    return hit;
  };
  try {
    assert.equal(hits([-1, 0.5, 0], [4, 0.5, 0]), false, "the current must pass under both bridge tiles");
    assert.equal(hits([2, 3, 0], [2, 1.9, 0]), true, "the deck supports walking");
    assert.equal(hits([2, 0.5, 0], [2, 1.9, 0]), true, "the deck underside remains solid");
    assert.equal(hits([0, 0.5, 0], [0, 0.5, 1]), true, "river banks remain solid");
  } finally {
    world.removeCollisionObject(body);
    surface.destroy();
    for (const resource of [from, to, body, transform, world, solver, broadphase, dispatcher, configuration, shape, triangles, ...vectors]) {
      Ammo.destroy(resource);
    }
  }
});

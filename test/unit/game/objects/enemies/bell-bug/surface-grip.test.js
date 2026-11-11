import assert from 'node:assert/strict';
import test from 'node:test';
import Ammo from 'sync-ammo/dist/ammo.module.js';
import { Entity, Vec3 } from 'playcanvas';
import { BellBug } from '../../../../../../src/game/objects/enemies/bell-bug/BellBug.js';
import { TerrainPhysicsSurface } from '../../../../../../src/game/collision/TerrainPhysicsSurface.js';

test('a queued Bell Bug stays on an ordinary terrain incline in the native solver', () => {
  let geometry;
  const pc = {
    Entity: class {
      tags = { add: () => {} };
      addComponent(type, value) {
        this[type] = value;
      }
      isDescendantOf() {
        return false;
      }
      destroy() {}
    },
    Mesh: class {
      constructor() {
        geometry = this;
      }
      setPositions(value) {
        this.positions = value;
      }
      setIndices(value) {
        this.indices = value;
      }
      update() {}
      destroy() {}
    },
    StandardMaterial: class {
      update() {}
      destroy() {}
    },
    GraphNode: class {},
    MeshInstance: class {},
    Model: class {},
  };
  const surface = new TerrainPhysicsSurface({
    pc,
    app: { graphicsDevice: {} },
    collisionWorld: null,
    mapData: {
      rows: 1,
      cols: 1,
      grid: [[2]],
      heightmap: [[0]],
      tileMeta: [[{
        shape: 'SLOPE',
        slope: {
          riseDirection: 'NORTH',
          highHeight: .5,
          lowHeight: 0,
        },
      }]],
    },
  });
  const resources = [];
  const keep = value => {
    resources.push(value);

    return value;
  };
  const configuration = keep(new Ammo.btDefaultCollisionConfiguration());
  const dispatcher = keep(new Ammo.btCollisionDispatcher(configuration));
  const broadphase = keep(new Ammo.btDbvtBroadphase());
  const solver = keep(new Ammo.btSequentialImpulseConstraintSolver());
  const world = keep(new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration));
  world.setGravity(keep(new Ammo.btVector3(0, -9.81, 0)));
  const triangles = keep(new Ammo.btTriangleMesh());
  const vertices = [keep(new Ammo.btVector3()), keep(new Ammo.btVector3()), keep(new Ammo.btVector3())];
  for (let index = 0; index < geometry.indices.length; index += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const offset = geometry.indices[index + corner] * 3;
      vertices[corner].setValue(...geometry.positions.slice(offset, offset + 3));
    }
    triangles.addTriangle(...vertices, true);
  }
  const createBody = (shape, mass, y) => {
    const transform = keep(new Ammo.btTransform());
    transform.setIdentity();
    transform.setOrigin(keep(new Ammo.btVector3(0, y, 0)));
    const inertia = keep(new Ammo.btVector3());
    if (mass) {
      shape.calculateLocalInertia(mass, inertia);
    }
    const motion = keep(new Ammo.btDefaultMotionState(transform));
    const info = keep(new Ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia));
    const body = keep(new Ammo.btRigidBody(info));
    world.addRigidBody(body, mass ? 2 : 1, -1);

    return body;
  };
  const ground = createBody(keep(new Ammo.btBvhTriangleMeshShape(triangles, true, true)), 0, 0);
  ground.setFriction(surface.entity.rigidbody.friction);
  const bug = new BellBug({
    pc: {
      Entity,
      Vec3,
    },
    app: { systems: { rigidbody: { raycastAll: () => [] } } },
    definition: { id: 'queued-on-incline' },
    runtime: { objects: [] },
  });
  bug.grounded = true;
  const shape = keep(new Ammo.btCapsuleShape(bug.radius, bug.height - bug.radius * 2));
  const body = createBody(shape, bug.mass, .25 + bug.height / 2 + .05);
  body.setAngularFactor(keep(new Ammo.btVector3(0, 0, 0)));
  const velocity = keep(new Ammo.btVector3());
  const from = keep(new Ammo.btVector3()), to = keep(new Ammo.btVector3());
  bug.app.systems.rigidbody.raycastAll = (start, end) => {
    from.setValue(start.x, start.y, start.z);
    to.setValue(end.x, end.y, end.z);
    const callback = new Ammo.ClosestRayResultCallback(from, to);
    callback.set_m_collisionFilterMask(1);
    world.rayTest(from, to, callback);
    try {
      if (!callback.hasHit()) {
        return [];
      }
      const point = callback.get_m_hitPointWorld(), normal = callback.get_m_hitNormalWorld();

      return [{
        entity: surface.entity,
        point: new Vec3(point.x(), point.y(), point.z()),
        normal: new Vec3(normal.x(), normal.y(), normal.z()),
      }];
    } finally {
      Ammo.destroy(callback);
    }
  };
  bug.entity.rigidbody = {
    get friction() {
      return body.getFriction();
    },
    set friction(value) {
      body.setFriction(value);
    },
    get linearVelocity() {
      const value = body.getLinearVelocity();

      return new Vec3(value.x(), value.y(), value.z());
    },
    set linearVelocity(value) {
      velocity.setValue(value.x, value.y, value.z);
      body.activate();
      body.setLinearVelocity(velocity);
    },
  };
  try {
    for (let frame = 0; frame < 120; frame++) {
      bug.stop();
      world.stepSimulation(1 / 60, 1, 1 / 60);
    }
    const start = body.getWorldTransform().getOrigin().z();
    assert.ok(Math.abs(start) < .05, `settling must retain the standing position: ${start}`);
    for (let frame = 0; frame < 600; frame++) {
      bug.stop();
      world.stepSimulation(1 / 60, 1, 1 / 60);
      const drift = Math.abs(body.getWorldTransform().getOrigin().z() - start);
      assert.ok(drift < .005, `queued body slid ${drift} m`);
    }
    assert.ok(body.getWorldTransform().getOrigin().y() > .4, 'gravity still settles the capsule onto the slope');
    // Rebuild contact so the walking check uses its own friction, rather than
    // a resting manifold's cached coefficient.
    world.removeRigidBody(body);
    world.addRigidBody(body, 2, -1);
    const target = { position: new Vec3(0, 0, -.4) };
    let previous = start;
    for (let frame = 0; frame < 3; frame++) {
      const position = body.getWorldTransform().getOrigin();
      bug.entity.setPosition(position.x(), position.y() - bug.height / 2, position.z());
      bug.moveToward(target, .5175);
      world.stepSimulation(.2, 12, 1 / 60);
      const current = body.getWorldTransform().getOrigin().z();
      assert.ok(current <= previous, `slow uphill walking slid back by ${current - previous} m during a long frame`);
      previous = current;
    }
    assert.ok(body.getWorldTransform().getOrigin().z() < start - .025, 'walking releases grip and advances uphill');
  } finally {
    world.removeRigidBody(body);
    world.removeRigidBody(ground);
    surface.destroy();
    for (const resource of resources.reverse()) {
      Ammo.destroy(resource);
    }
  }
});

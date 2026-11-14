import test from "node:test";
import assert from "node:assert/strict";
import { Entity, EventHandler, Vec3 } from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { LatchBridgeContact } from "../../../../../../src/game/objects/enemies/latch-slug/LatchBridgeContact.js";
import { LatchBridgeState } from "../../../../../../src/game/objects/enemies/latch-slug/states/LatchBridgeState.js";

test("a native capsule extends its predecessor grip and transfers only after contacting the sloped next section", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const gravity = new Ammo.btVector3(0, -22, 0);
  world.setGravity(gravity);
  Ammo.destroy(gravity);
  const app = new EventHandler();
  const system = new EventHandler();
  system.dynamicsWorld = world;
  app.systems = { rigidbody: system };
  const resources = [];
  const bodies = [];
  /**
   * @param {Entity} entity
   * @param {number} mass
   * @param {Vec3} half
   */
  const create = (entity, mass, half) => {
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const position = entity.getPosition();
    const origin = new Ammo.btVector3(position.x, position.y, position.z);
    transform.setOrigin(origin);
    Ammo.destroy(origin);
    const rotation = entity.getRotation();
    const quaternion = new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    transform.setRotation(quaternion);
    Ammo.destroy(quaternion);
    const size = new Ammo.btVector3(half.x, half.y, half.z);
    let shape;
    if (mass) {
      shape = new Ammo.btCompoundShape();
      const sphere = new Ammo.btSphereShape(0.42);
      const local = new Ammo.btTransform();
      local.setIdentity();
      const center = new Ammo.btVector3(0, 0.42, 0);
      local.setOrigin(center);
      shape.addChildShape(local, sphere);
      Ammo.destroy(center);
      Ammo.destroy(local);
      resources.push(sphere);
    } else {
      shape = new Ammo.btBoxShape(size);
    }
    Ammo.destroy(size);
    const motion = new Ammo.btDefaultMotionState(transform);
    const inertia = new Ammo.btVector3(0, 0, 0);
    if (mass) {
      shape.calculateLocalInertia(mass, inertia);
    }
    const info = new Ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia);
    const body = new Ammo.btRigidBody(info);
    const angular = new Ammo.btVector3(0, 0, 0);
    body.setAngularFactor(angular);
    Ammo.destroy(angular);
    Ammo.destroy(info);
    Ammo.destroy(inertia);
    Ammo.destroy(transform);
    resources.push(shape, motion, body);
    bodies.push(body);
    world.addRigidBody(body);
    entity.rigidbody = { body };

    return body;
  };
  const source = new Entity();
  source.setPosition(0, 2.1, 0);
  const predecessor = new Entity();
  predecessor.setPosition(0, 2, 0);
  predecessor.tags.add("hero-moving-support");
  const next = new Entity();
  next.setPosition(0.66339746, 1.6169873, 0);
  next.setEulerAngles(0, 0, -60);
  next.tags.add("hero-moving-support");
  const sourceBody = create(source, 1, new Vec3());
  create(predecessor, 0, new Vec3(0.35, 0.1, 1));
  const nextBody = create(next, 0, new Vec3(0.5, 0.1, 1));
  const owner = {
    app,
    entity: source,
    position: source.getPosition(),
    radius: 0.42,
    height: 0.84,
    alive: true,
  };
  const state = new LatchBridgeState();
  let latch;
  /**
   * @param {boolean} [nextOnly]
   * @returns {Vec3|null}
   */
  const step = (nextOnly = true) => {
    world.stepSimulation(1 / 60, 1, 1 / 60);
    const root = sourceBody.getWorldTransform().getOrigin();
    source.setPosition(root.x(), root.y(), root.z());
    for (let index = 0; index < dispatcher.getNumManifolds(); index++) {
      const manifold = dispatcher.getManifoldByIndexInternal(index);
      const first = Ammo.getPointer(manifold.getBody0()) === Ammo.getPointer(nextBody);
      const second = Ammo.getPointer(manifold.getBody1()) === Ammo.getPointer(nextBody);
      if (manifold.getNumContacts() && (!nextOnly || first || second)) {
        const contact = manifold.getContactPoint(0);
        if (contact.getDistance() > 0.001) {
          continue;
        }
        const point = first ? contact.getPositionWorldOnA() : contact.getPositionWorldOnB();

        return new Vec3(point.x(), point.y(), point.z());
      }
    }

    return null;
  };
  try {
    assert.ok(step(false), "the initial predecessor attachment begins with real native contact");
    latch = new LatchBridgeContact(owner, predecessor, new Vec3(0, 2.1, 0));
    state.contactLatch = latch;
    state.assignment = {
      station: 2,
      position: new Vec3(0.75, 1.67, 0),
      approach: new Vec3(0.5, 2.1, 0),
      supports: [{ entity: predecessor }, { entity: next }],
    };
    let touching = null;
    for (let frame = 0; frame < 120; frame++) {
      latch.crawl(new Vec3(0.35, 2.1, 0), 1 / 60);
      touching = step();
    }
    assert.equal(touching, null, "the rounded capsule has not reached the downward sloping next surface");
    for (let frame = 0; frame < 240 && !touching; frame++) {
      latch.extend(new Vec3(0.5, 2.1, 0), 1 / 60);
      touching = step();
    }
    assert.ok(touching, "bounded native grip extension must produce an actual collision manifold: " + JSON.stringify({
      root: source.getPosition().toArray(),
      anchor: latch.point.toArray(),
      extension: latch.extension.toArray(),
      pivotA:[latch.constraint.getPivotInA().x(),latch.constraint.getPivotInA().y()],
      pivotB:[latch.constraint.getPivotInB().x(),latch.constraint.getPivotInB().y()],
    }));
    assert.ok(source.getPosition().y < 2.09, "the native solver carries the capsule down toward the real next surface: " + source.getPosition().toString());
    state.contact(owner, {
      other: next,
      contacts: [{ pointOther: touching }],
    });
    assert.equal(state.contactLatch.other, next);
    assert.equal(latch.constraint, null, "only the verified new contact retires the predecessor grip");
    const grip = state.contactLatch;
    const edge = grip.point.clone();
    const placement = {
      supports: [{ entity: next }],
      placementEdge: edge,
      position: edge.clone().add(new Vec3(0.5, 0, 0)),
    };
    assert.equal(LatchBridgeState.reachesPlacement(owner, grip, placement), true,
      "the native capsule's actual surface attachment authorizes its local material reach");
    placement.position.x += 1;
    assert.equal(LatchBridgeState.reachesPlacement(owner, grip, placement), false,
      "a real native grip never authorizes remote material placement");
  } finally {
    state.contactLatch?.destroy();
    latch?.destroy();
    for (const body of bodies) {
      world.removeRigidBody(body);
    }
    for (const resource of resources.reverse()) {
      Ammo.destroy(resource);
    }
    Ammo.destroy(world);
    Ammo.destroy(solver);
    Ammo.destroy(broadphase);
    Ammo.destroy(dispatcher);
    Ammo.destroy(configuration);
    globalThis.Ammo = previous;
  }
});

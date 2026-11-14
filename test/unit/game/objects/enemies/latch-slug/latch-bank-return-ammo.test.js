import test from "node:test";
import assert from "node:assert/strict";
import { Entity, EventHandler, Vec3 } from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { LatchBankReturn } from "../../../../../../src/game/objects/enemies/latch-slug/LatchBankReturn.js";

for (const scenario of ["same", "separate", "blocked", "gel-overhang", "gel-blocked", "long-friction", "stuck-floor", "stepped-bank"]) {
  test(`a recovered twelve-kilogram capsule physically returns across a ${scenario} bank lip`, () => {
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
    const entries = [];
    const resources = [];
    /**
   * @param {Vec3} position
   * @param {Vec3} half
   * @param {number} mass
   */
    const create = (position, half, mass = 0) => {
      const entity = new Entity();
      entity.setPosition(position);
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      const nativePosition = new Ammo.btVector3(position.x, position.y, position.z);
      transform.setOrigin(nativePosition);
      Ammo.destroy(nativePosition);
      let shape;
      if (mass && half.length() === 0) {
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
        const size = new Ammo.btVector3(half.x, half.y, half.z);
        shape = new Ammo.btBoxShape(size);
        Ammo.destroy(size);
      }
      const motion = new Ammo.btDefaultMotionState(transform);
      const inertia = new Ammo.btVector3(0, 0, 0);
      if (mass) {
        shape.calculateLocalInertia(mass, inertia);
      }
      const info = new Ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia);
      const body = new Ammo.btRigidBody(info);
      body.setFriction(scenario === "long-friction" ? 2 : 0.5);
      const zero = new Ammo.btVector3(0, 0, 0);
      if (half.length() === 0) {
        body.setAngularFactor(zero);
      }
      Ammo.destroy(zero);
      Ammo.destroy(info);
      Ammo.destroy(inertia);
      Ammo.destroy(transform);
      world.addRigidBody(body, mass ? 1 : 2, -1);
      entity.rigidbody = {
        body,
        type: mass ? "dynamic" : "static",
        group: mass ? 1 : 2,
        mask: -1,
      };
      Object.defineProperty(entity.rigidbody, "linearVelocity", {
        get: () => {
          const velocity = body.getLinearVelocity();

          return new Vec3(velocity.x(), velocity.y(), velocity.z());
        },
        set: (value) => {
          const velocity = new Ammo.btVector3(value.x, value.y, value.z);
          body.setLinearVelocity(velocity);
          body.activate(true);
          Ammo.destroy(velocity);
        },
      });
      entries.push({
        entity,
        body,
      });
      resources.push(shape, motion, body);

      return entity;
    };
    const breadth = scenario === "gel-overhang" || scenario === "stepped-bank" ? 3.5 : scenario === "gel-blocked" ? 0.8 : 1.5;
    const floor = create(new Vec3(-2, -0.1, 0), new Vec3(4, 0.1, breadth));
    const bank = scenario === "separate" ? create(new Vec3(1, 0.975, 0), new Vec3(1, 0.975, 1.5)) :
      create(new Vec3(1, 1, 0), new Vec3(1, 1, breadth));
    const gel = scenario.startsWith("gel-") || scenario === "stepped-bank" ? create(new Vec3(0.4, 2.1, 0), new Vec3(0.9, 0.1, 0.5), 12) : null;
    const strips = [];
    if (scenario === "stepped-bank") {
      for (const side of [-1, 1]) {
        strips.push(create(new Vec3(-2, 0.25, side * 1.75), new Vec3(4, 0.25, 0.75)));
      }
    }
    const obstacle = scenario === "stuck-floor" ? create(new Vec3(-2, 0.5, 0), new Vec3(0.15, 0.5, 1.5)) : null;
    const platform = scenario === "separate" ? create(new Vec3(1, 1.975, 0), new Vec3(1, 0.025, 1.5)) : null;
    if (scenario === "blocked") {
      create(new Vec3(1, 2.25, 0), new Vec3(1, 0.1, 1.5));
    }
    const source = create(new Vec3(scenario === "long-friction" ? -4.5 : scenario === "stuck-floor" ? -3 : -0.9, 0, 0), new Vec3(), 12);
    const app = new EventHandler();
    const system = new EventHandler();
    app.systems = { rigidbody: system };
    system.dynamicsWorld = world;
    system.raycastFirst = (from, to, options) => {
      const start = new Ammo.btVector3(from.x, from.y, from.z);
      const end = new Ammo.btVector3(to.x, to.y, to.z);
      const callback = new Ammo.AllHitsRayResultCallback(start, end);
      world.rayTest(start, end, callback);
      let result = null;
      let closest = Infinity;
      if (callback.hasHit()) {
        const objects = callback.get_m_collisionObjects();
        for (let index = 0; index < objects.size(); index++) {
          const pointer = Ammo.getPointer(objects.at(index));
          const entry = entries.find((entry) => Ammo.getPointer(entry.body) === pointer);
          const fraction = callback.get_m_hitFractions().at(index);
          if (!entry || !options.filterCallback(entry.entity) || fraction >= closest) {
            continue;
          }
          closest = fraction;
          const point = callback.get_m_hitPointWorld().at(index);
          const normal = callback.get_m_hitNormalWorld().at(index);
          result = {
            entity: entry.entity,
            point: new Vec3(point.x(), point.y(), point.z()),
            normal: new Vec3(normal.x(), normal.y(), normal.z()),
          };
        }
      }
      Ammo.destroy(callback);
      Ammo.destroy(start);
      Ammo.destroy(end);

      return result;
    };
    const owner = {
      app,
      pc: { Vec3 },
      entity: source,
      radius: 0.42,
      height: 0.84,
      airborne: false,
      grounded: true,
      get position() {
        return source.getPosition();
      },
      faceTarget: () => {},
      stop: () => {
        const velocity = source.rigidbody.linearVelocity;
        source.rigidbody.linearVelocity = new Vec3(0, velocity.y, 0);
      },
    };
    const controller = new LatchBankReturn(owner, new Vec3(0.8, 2, 0));
    let result = "working";
    let bound = false;
    let rolled = false;
    let largestStep = 0;
    let maxRiseVelocity = 0;
    let wallContacts = 0;
    let platformContacts = 0;
    let platformGripped = false;
    let gelContacts = 0;
    let largestGelRise = 0;
    let walkSeconds = 0;
    let obstacleContacts = 0;
    let stepGripped = false;
    let previousPosition = owner.position.clone();
    try {
      for (let frame = 0; frame < 9000 && result === "working"; frame++) {
        walkSeconds += Number(controller.phase === "walk") / 60;
        result = controller.update(1 / 60);
        world.stepSimulation(1 / 60, scenario === "long-friction" ? 4 : 1, scenario === "long-friction" ? 1 / 240 : 1 / 60);
        const root = source.rigidbody.body.getWorldTransform().getOrigin();
        source.setPosition(root.x(), root.y(), root.z());
        if (gel) {
          largestGelRise = Math.max(largestGelRise, gel.rigidbody.body.getWorldTransform().getOrigin().y() - 2.1);
        }
        largestStep = Math.max(largestStep, owner.position.distance(previousPosition));
        previousPosition = owner.position.clone();
        maxRiseVelocity = Math.max(maxRiseVelocity, source.rigidbody.linearVelocity.y);
        bound ||= Boolean(controller.grip?.point);
        stepGripped ||= strips.includes(controller.grip?.other);
        platformGripped ||= Boolean(platform && controller.grip?.other === platform);
        rolled ||= controller.phase === "roll" || controller.phase === "top";
        for (let index = 0; index < dispatcher.getNumManifolds(); index++) {
          const manifold = dispatcher.getManifoldByIndexInternal(index);
          const sourceFirst = Ammo.getPointer(manifold.getBody0()) === Ammo.getPointer(source.rigidbody.body);
          const sourceSecond = Ammo.getPointer(manifold.getBody1()) === Ammo.getPointer(source.rigidbody.body);
          if (!sourceFirst && !sourceSecond) {
            continue;
          }
          const pointer = Ammo.getPointer(sourceFirst ? manifold.getBody1() : manifold.getBody0());
          const other = entries.find((entry) => Ammo.getPointer(entry.body) === pointer)?.entity;
          for (let contactIndex = 0; contactIndex < manifold.getNumContacts(); contactIndex++) {
            const contact = manifold.getContactPoint(contactIndex);
            if (contact.getDistance() > 0.001) {
              continue;
            }
            const point = sourceFirst ? contact.getPositionWorldOnB() : contact.getPositionWorldOnA();
            const normal = contact.get_m_normalWorldOnB();
            if (other === bank && Math.abs(normal.y()) < 0.3) {
              wallContacts++;
            }
            if (other === platform) {
              platformContacts++;
            }
            if (other === gel) {
              gelContacts++;
            }
            if (other === obstacle) {
              obstacleContacts++;
            }
            if (other === floor) {
              owner.airborne = false;
              owner.grounded = true;
            }
            controller.contact({
              other,
              contacts: [{
                pointOther: new Vec3(point.x(), point.y(), point.z()),
                normal: new Vec3(normal.x(), normal.y(), normal.z()),
              }],
            });
          }
        }
      }
      if (obstacle) {
        assert.ok(obstacleContacts > 0, "the stalled floor route must encounter an actual native obstacle");
        assert.ok(walkSeconds < 20, "a genuinely stalled route must release within its bounded progress budget");
      } else {
        assert.ok(wallContacts > 0, "binding must originate in an actual native wall manifold");
      }
      const blocked = scenario === "blocked" || scenario === "gel-blocked" || scenario === "stuck-floor";
      assert.equal(result, blocked ? "failed" : "complete", JSON.stringify({
        phase: controller.phase,
        position: owner.position.toArray(),
        grip: controller.grip?.point?.toArray(),
        target: controller.target.toArray(),
        resume: controller.resumeTarget?.toArray(),
        blocked: controller.blocked,
        age: controller.age,
        progressAge: controller.walkProgressAge,
      }));
      assert.equal(bound, scenario !== "gel-blocked" && scenario !== "stuck-floor");
      if (scenario === "long-friction") {
        assert.ok(walkSeconds > 25, "actual high-friction progress must remain eligible after the old fixed timeout: " + walkSeconds);
      }
      if (scenario === "stepped-bank") {
        assert.equal(stepGripped, true, "the half-metre terrain strip must be climbed through its actual native contact before the upper bank");
      }
      assert.equal(rolled, !blocked);
      if (blocked) {
        assert.ok(owner.position.y < 0.13, "blocked lip retreats to its actual original lower floor");
      } else {
        assert.ok(owner.position.y > 1.9 && owner.position.x > 0.35);
      }
      if (platform) {
        assert.ok(platformContacts > 0, "foreign platform must be acquired through native contact");
        assert.equal(platformGripped, true, "old wall grip must physically transfer to the actual foreign platform");
      }
      if (gel) {
        const origin = gel.rigidbody.body.getWorldTransform().getOrigin();
        const rotation = gel.rigidbody.body.getWorldTransform().getRotation();
        assert.ok(Math.abs(origin.y() - 2.1) < 0.08, "recovery cannot lift the actual dynamic bridge underside");
        assert.ok(Math.abs(rotation.x()) + Math.abs(rotation.z()) < 0.1, "recovery cannot overturn the native gel body");
        assert.equal(gelContacts, 0, "the recovering capsule must never collide with the bridge underside");
        assert.ok(largestGelRise < 0.05, "no transient recovery force may lift the native gel");
        if (!blocked) {
          assert.ok(Math.abs(owner.position.z) > 1.35, "real floor travel must reach the unobstructed bank face");
        }
      }
      assert.ok(largestStep < 0.08, "all motion must remain gradual native constraint motion: " + largestStep);
      assert.ok(maxRiseVelocity < 0.8, "the actor climbs without a ballistic jump: " + maxRiseVelocity);
    } finally {
      controller.destroy();
      for (const entry of entries) {
        world.removeRigidBody(entry.body);
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
}

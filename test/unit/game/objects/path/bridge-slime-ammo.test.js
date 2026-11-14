import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { LatchBridgeContact } from "../../../../../src/game/objects/enemies/latch-slug/LatchBridgeContact.js";
import { ACTOR_MASS } from "../../../../../src/game/enum/ActorMass.js";
import { BridgeSlimePhysics } from "../../../../../src/game/objects/path/BridgeSlimePhysics.js";

for (const [length, retry, anticipating, gameGravity, frameRate, lateralOffset, initialCount, bankContact, axis, fromEnd, voidGround] of [[3, 0], [3, 3], [6, 0], [6, 3], [3, 0, true], [6, 0, true], [3, 0, true, true], [3, 3, true, true], [3, 0, true, true, 20], [3, 0, true, true, 60, 0.65], [6, 0, true, true, 60, 0.15, 3], [6, 0, true, true, 60, 0.15, 2, true], [3, 0, true, false, 60, 0.15, undefined, false, "z", false], [3, 0, true, false, 60, 0.15, undefined, false, "x", true], [3, 0, true, false, 60, 0.15, undefined, false, "z", true], [6, 0, true, true, 60, 0.15, undefined, true, "x", false, true], [6, 0, true, true, 60, 0.15, undefined, true, "z", false, true], [6,0,true,true,75,0.15,3,true], [6,0,true,true,90,0.15,3,true], [6,0,true,true,120,0.15,3,true]]) {
  it(`sags and reaches a ${length}-tile span with ${retry} prior failures${anticipating ? " and proactive reshaping" : ""}${gameGravity ? " at game gravity" : ""}${frameRate ? " with " + frameRate + " Hz updates" : ""}${lateralOffset ? " from a side contact" : ""}${initialCount ? " over " + initialCount + " existing masses" : ""}${bankContact ? " against the actual bank face" : ""}${axis ? " on " + axis + (fromEnd ? " from end bank" : " from start bank") : ""}${voidGround ? " over a true void" : ""} through native Ammo contacts and progressive mass`, () => {
    const horizontal = axis !== "z";
    const position = (along, y = 2, across = 0) => new pc.Vec3(horizontal ? along : across, y, horizontal ? across : along);
    const bankStation = fromEnd ? length - 1 : 0;
    const supportNear = (station) => fromEnd ? station >= length : station < 0;
    const stepTime = 1 / (frameRate ?? 60);
    const frameScale = Math.max(1, (frameRate ?? 60) / 60);
    const gravityY = length === 6 || gameGravity ? -22 : -9.81;
    const floorHeight = length === 6 || gameGravity ? 0.5 : 1.05;
    const configuration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(configuration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
    const gravity = new Ammo.btVector3(0, gravityY, 0);
    world.setGravity(gravity);
    Ammo.destroy(gravity);
    const floorTransform = new Ammo.btTransform();
    floorTransform.setIdentity();
    const floorPoint = new Ammo.btVector3(0, floorHeight - 0.1, 0);
    floorTransform.setOrigin(floorPoint);
    Ammo.destroy(floorPoint);
    const floorSize = new Ammo.btVector3(20, 0.1, 20);
    const floorShape = new Ammo.btBoxShape(floorSize);
    Ammo.destroy(floorSize);
    const floorMotion = new Ammo.btDefaultMotionState(floorTransform);
    const zero = new Ammo.btVector3(0, 0, 0);
    const floorInfo = new Ammo.btRigidBodyConstructionInfo(0, floorMotion, floorShape, zero);
    const floor = new Ammo.btRigidBody(floorInfo);
    Ammo.destroy(zero);
    Ammo.destroy(floorInfo);
    if (!voidGround) {
      world.addRigidBody(floor, pc.BODYGROUP_STATIC, pc.BODYMASK_ALL);
    }
    const constraints = new Set();
    const constraintBodies = new Map();
    const hasConstraintOn = (body) => [...constraints].some((joint) => constraintBodies.get(joint)?.includes(body));
    const deckConstraintCount = () => [...constraints].filter((joint) => !joint.slimeTruss).length;
    const add = world.addConstraint.bind(world);
    const remove = world.removeConstraint.bind(world);
    world.addConstraint = (joint, disabled) => {
      constraints.add(joint); add(joint, disabled);
    };
    world.removeConstraint = (joint) => {
      constraints.delete(joint); remove(joint);
    };
    class Entity extends pc.Entity {
      addComponent(type, options) {
        if (type === "collision") {
          let half = options.halfExtents;
          const owner = this;
          this.collision = {
            type: options.type,
            get halfExtents() {
              return half;
            },
            set halfExtents(value) {
              assert.equal(owner.rigidbody ? hasConstraintOn(owner.rigidbody.body) : false, false, "resize must not invalidate a constraint referring to its actual native body");
              half = value;
              if (owner.rigidbody) {
                owner.rigidbody.dispose();
                owner.addComponent("rigidbody", owner.nativeOptions);
              }
            },
          };

          return;
        }
        this.nativeOptions = options;
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        const position = this.getPosition();
        const point = new Ammo.btVector3(position.x, position.y, position.z);
        transform.setOrigin(point);
        Ammo.destroy(point);
        const rotation = this.getRotation();
        const quaternion = new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        transform.setRotation(quaternion);
        Ammo.destroy(quaternion);
        const half = this.collision.halfExtents;
        const size = new Ammo.btVector3(half.x, half.y, half.z);
        let childShape = null;
        let shape;
        if (this.collision.type === "worker") {
          shape = new Ammo.btCompoundShape();
          childShape = new Ammo.btSphereShape(half.x);
          const offset = new Ammo.btTransform();
          offset.setIdentity();
          const center = new Ammo.btVector3(0, half.x, 0);
          offset.setOrigin(center);
          shape.addChildShape(offset, childShape);
          Ammo.destroy(center);
          Ammo.destroy(offset);
        } else {
          shape = this.collision.type === "sphere" ? new Ammo.btSphereShape(half.x) : new Ammo.btBoxShape(size);
        }
        Ammo.destroy(size);
        const inertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(options.mass, inertia);
        const motion = new Ammo.btDefaultMotionState(transform);
        const info = new Ammo.btRigidBodyConstructionInfo(options.mass, motion, shape, inertia);
        const body = new Ammo.btRigidBody(info);
        body.setDamping(options.linearDamping, options.angularDamping);
        world.addRigidBody(body, options.group ?? pc.BODYGROUP_DYNAMIC, options.mask ?? pc.BODYMASK_ALL);
        Ammo.destroy(info);
        Ammo.destroy(inertia);
        const entity = this;
        this.rigidbody = {
          group: options.group,
          mask: options.mask,
          get mass() {
            return options.mass;
          },
          set mass(value) {
            options.mass = value;
            const inertia = new Ammo.btVector3(0, 0, 0);
            shape.calculateLocalInertia(value, inertia);
            body.setMassProps(value, inertia);
            body.updateInertiaTensor();
            Ammo.destroy(inertia);
          },
          body,
          get linearVelocity() {
            const velocity = body.getLinearVelocity();

            return new pc.Vec3(velocity.x(), velocity.y(), velocity.z());
          },
          set linearVelocity(velocity) {
            const value = new Ammo.btVector3(velocity.x, velocity.y, velocity.z);
            body.setLinearVelocity(value);
            Ammo.destroy(value);
          },
          get angularVelocity() {
            const velocity = body.getAngularVelocity();

            return new pc.Vec3(velocity.x(), velocity.y(), velocity.z());
          },
          set angularVelocity(velocity) {
            const value = new Ammo.btVector3(velocity.x, velocity.y, velocity.z);
            body.setAngularVelocity(value);
            Ammo.destroy(value);
          },
          applyForce: (force) => {
            body.activate();
            const value = new Ammo.btVector3(force.x, force.y, force.z);
            body.applyCentralForce(value);
            Ammo.destroy(value);
          },
          applyTorque: (torque) => {
            body.activate();
            const value = new Ammo.btVector3(torque.x, torque.y, torque.z);
            body.applyTorque(value);
            Ammo.destroy(value);
          },
          sync: () => {
            motion.getWorldTransform(transform);
            const p = transform.getOrigin();
            const q = transform.getRotation();
            entity.setPosition(p.x(), p.y(), p.z());
            entity.setRotation(q.x(), q.y(), q.z(), q.w());
          },
          dispose: () => {
            if (entity.name.startsWith("Living bridge")) {
              assert.equal(hasConstraintOn(body), false);
            }
            world.removeRigidBody(body);
            if (childShape) {
              Ammo.destroy(childShape);
            }
            for (const allocation of [body, motion, shape, transform]) {
              Ammo.destroy(allocation);
            }
          },
        };
      }
      destroy() {
        this.rigidbody?.dispose();
        this.rigidbody = null;
        super.destroy();
      }
    }
    const previous = globalThis.Ammo;
    globalThis.Ammo = {
      ...Ammo,
      btPoint2PointConstraint: class {
        constructor(...args) {
          const joint = new Ammo.btPoint2PointConstraint(...args);
          constraintBodies.set(joint, args.length === 4 ? [args[0], args[1]] : [args[0]]);

          return joint;
        }
      },
    };
    const root = new Entity();
    const app = {
      root,
      systems: {
        rigidbody: {
          dynamicsWorld: world,
          gravity: new pc.Vec3(0, gravityY, 0),
          raycastFirst: (start, end) => {
            const from = new Ammo.btVector3(start.x, start.y, start.z);
            const to = new Ammo.btVector3(end.x, end.y, end.z);
            const callback = new Ammo.ClosestRayResultCallback(from, to);
            callback.set_m_collisionFilterMask(pc.BODYGROUP_STATIC);
            world.rayTest(from, to, callback);
            let result = null;
            if (callback.hasHit()) {
              const hit = callback.get_m_hitPointWorld();
              const normal = callback.get_m_hitNormalWorld();
              result = {
                point: new pc.Vec3(hit.x(), hit.y(), hit.z()),
                normal: new pc.Vec3(normal.x(), normal.y(), normal.z()),
              };
            }
            for (const allocation of [callback, from, to]) {
              Ammo.destroy(allocation);
            }

            return result;
          },
        },
      },
    };
    const appEvents = new pc.EventHandler();
    const bodyEvents = new pc.EventHandler();
    app.on = appEvents.on.bind(appEvents);
    app.fire = appEvents.fire.bind(appEvents);
    app.systems.rigidbody.on = bodyEvents.on.bind(bodyEvents);
    const physics = new BridgeSlimePhysics({
      pc: {
        ...pc,
        Entity,
      },
      app,
      root,
      horizontal,
    });
    const bank = bankContact ? new Entity("Actual bank contact") : null;
    if (bank) {
      bank.setPosition(position(-2.5, 1));
      bank.addComponent("collision", {
        halfExtents: horizontal ? new pc.Vec3(2, 1, 5) : new pc.Vec3(5, 1, 2),
      });
      bank.addComponent("rigidbody", {
        mass: 0,
        linearDamping: 0,
        angularDamping: 0,
      });
    }
    const retries = new Map([[1, retry]]);
    let contributor = null;
    let contributorGrip = null;
    let contributorOwner = null;
    try {
      const stations = new Map();
      for (let index = 0; index < (initialCount ?? (length === 3 ? 2 : 1)); index++) {
        const station = fromEnd ? length - 1 - index : index;
        stations.set(station, position(station));
      }
      const bearing = fromEnd ? length - stations.size : stations.size - 1;
      physics.sync(stations, supportNear, false, retries, anticipating ? new Map([[bearing, fromEnd ? -1 : 1]]) : new Map());
      assert.equal(deckConstraintCount(), stations.size * 3);
      assert.ok(Math.abs(root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - stations.size * ACTOR_MASS.LATCH_SLUG) < 1e-9, "each actual donor retains its full native actor mass after transformation");
      if (anticipating) {
        const before = physics.getPose(bankStation).thickness;
        for (let frame = 0; frame < Math.ceil(1.85 / stepTime); frame++) {
          physics.update(stepTime);
          world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
          for (const entity of root.children) {
            entity.rigidbody.sync();
          }
          const material = [...physics.update(0).values()];
          const volume = material.reduce((sum, pose) => sum + pose.width * pose.thickness + pose.braces.reduce((v, brace) => v + brace.volume, 0), 0);
          assert.ok(Math.abs(volume - stations.size) < 1e-8, "every preparation step conserves deck plus actual rod volume");
          assert.ok(Math.abs(root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - stations.size * ACTOR_MASS.LATCH_SLUG) < 1e-8, "every preparation step conserves all native material mass");
        }
        assert.ok(physics.getPose(bankStation).thickness > before * (retry ? 1.02 : 1.2), "predecessors must physically reshape before the incoming actor exists");
        for (const station of stations.keys()) {
          const entity = physics.getEntity(station);
          const shape = Ammo.castObject(entity.rigidbody.body.getCollisionShape(), Ammo.btCompoundShape);
          assert.equal(shape.getNumChildShapes(), 3, "native compound must contain the three authored material sections");
          const nativePose = entity.rigidbody.body.getCenterOfMassTransform();
          const nativePoint = nativePose.getOrigin();
          const nativeQuaternion = nativePose.getRotation();
          const nativeRotation = new pc.Quat(nativeQuaternion.x(), nativeQuaternion.y(), nativeQuaternion.z(), nativeQuaternion.w());
          const nativeTransform = new pc.Mat4().setTRS(new pc.Vec3(nativePoint.x(), nativePoint.y(), nativePoint.z()), nativeRotation, pc.Vec3.ONE);
          const inverseRendered = entity.getWorldTransform().clone().invert();
          for (const section of physics.getPose(station).sections) {
            // Motion-state rendering can interpolate a fraction behind Ammo.
            // Compare section geometry and ray contacts at the same native pose.
            const normal = nativeRotation.transformVector(pc.Vec3.UP);
            const local = inverseRendered.transformPoint(section.position);
            const top = nativeTransform.transformPoint(local.add(new pc.Vec3(0, section.halfExtents.y, 0)));
            const from = top.clone().add(normal.clone().mulScalar(0.03));
            const to = top.clone().sub(normal.clone().mulScalar(0.03));
            const a = new Ammo.btVector3(from.x, from.y, from.z);
            const b = new Ammo.btVector3(to.x, to.y, to.z);
            const callback = new Ammo.ClosestRayResultCallback(a, b);
            world.rayTest(a, b, callback);
            assert.ok(callback.hasHit(), "every rendered section surface must exist in actual native collision");
            const point = callback.get_m_hitPointWorld();
            assert.ok(top.distance(new pc.Vec3(point.x(), point.y(), point.z())) < 0.0001, JSON.stringify({
              top,
              actual: new pc.Vec3(point.x(), point.y(), point.z()),
              station,
            }));
            for (const allocation of [callback, a, b]) {
              Ammo.destroy(allocation);
            }
          }
        }
      }
      {
        contributor = new Entity("Live construction contributor");
        root.addChild(contributor);
        contributor.setPosition(physics.getPose(bearing).position.clone().add(position(0, 0.25, lateralOffset ?? 0.15)));
        contributor.addComponent("collision", {
          type: "worker",
          halfExtents: new pc.Vec3(0.42, 0.42, 0.42),
        });
        contributor.addComponent("rigidbody", {
          mass: ACTOR_MASS.LATCH_SLUG,
          linearDamping: 0,
          angularDamping: 0.8,
        });
        const locked = new Ammo.btVector3(0, 0, 0);
        contributor.rigidbody.body.setAngularFactor(locked);
        contributor.rigidbody.body.setFriction(0.4);
        Ammo.destroy(locked);
        contributorOwner = {
          app,
          entity: contributor,
          position: contributor.getPosition().clone(),
          height: 0.84,
          radius: 0.42,
        };
      }
      let touchedGround = false;
      let loadedStableTime = 0;
      for (let frame = 0; frame < (initialCount ? Math.ceil(12 / stepTime) : 360 * frameScale); frame++) {
        // Load the second predecessor (or the single bank reservoir) with
        // a 12 kg contributor before any complete suspension exists.
        if (contributorGrip) {
          contributorOwner.position.copy(contributor.getPosition());
          contributorGrip.crawl(fromEnd ? physics.getPose(bearing).start : physics.getPose(bearing).end, stepTime);
        }
        world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
        for (const entity of root.children) {
          entity.rigidbody.sync();
        }
        physics.update(stepTime);
        for (let index = 0; index < dispatcher.getNumManifolds(); index++) {
          const manifold = dispatcher.getManifoldByIndexInternal(index);
          touchedGround ||= manifold.getNumContacts() > 0;
          if (contributor && !contributorGrip && manifold.getNumContacts() > 0) {
            const first = Ammo.getPointer(manifold.getBody0());
            const second = Ammo.getPointer(manifold.getBody1());
            const actor = Ammo.getPointer(contributor.rigidbody.body);
            const support = physics.getEntity(bearing);
            const tissue = Ammo.getPointer(support.rigidbody.body);
            if ((first === actor && second === tissue) || (second === actor && first === tissue)) {
              const point = manifold.getContactPoint(0).getPositionWorldOnA();
              const contact = new pc.Vec3(point.x(), point.y(), point.z());
              contributorGrip = new LatchBridgeContact(contributorOwner, support, contact, true);
            }
          }
        }
        if (initialCount && contributorGrip) {
          loadedStableTime = physics.getPlacementStatus(bearing) === "stable" ? loadedStableTime + stepTime : 0;
          if (loadedStableTime >= 0.2) {
            break;
          }
        }
      }
      const bankMass = physics.getEntity(bankStation);
      assert.ok(bankMass.up.y > 0.92, "temporary bank-face attachment keeps the loaded first reservoir walkable: " + bankMass.up.y);
      assert.ok(bankMass.getWorldTransform().transformPoint(position(fromEnd ? 0.5 : -0.5, 0)).distance(position(bankStation + (fromEnd ? 0.5 : -0.5), 1.87)) < 0.1, "the first donor cannot fly away from its adhesive bank contact");
      {
        assert.ok(contributorGrip, "incoming worker must contact its actual live predecessor: " + JSON.stringify(physics.getPose(bearing)));
        const expectedRoot = contributorGrip.other.getWorldTransform().transformPoint(contributorGrip.anchor.clone().add(contributorGrip.rootOffset)).sub(contributor.getWorldTransform().transformVector(contributorGrip.extension));
        assert.ok(contributor.getPosition().distance(expectedRoot) < 0.06, "the actual foot root must follow its native body-local contact pivots");
        assert.ok(contributor.getPosition().y > (voidGround ? 0 : floorHeight + (initialCount ? -0.05 : 0.15)), "native terrain must support a loaded worker when finite construction support reaches the lower channel");
        if (initialCount) {
          assert.equal(physics.getFailedStations().includes(0), false, "frontier overload must not silently discard the real bank attachment");
          assert.equal(physics.getPlacementStatus(bearing), "stable", "this fresh three-mass structure must carry the real fourth worker without inventing a failure");
          assert.equal(physics.isTraversalSafe(bearing), true, "safe native equilibrium must remain traversable");
        } else {
          assert.deepEqual(physics.getFailedStations(), [], "normal contributor edge load must not invert an existing predecessor");
        }
        assert.ok(touchedGround, "the contributor must form real native collision manifolds on the incomplete tissue");
        assert.ok(contributorGrip, "construction adhesion must begin at a real contributor/tissue manifold");
        contributorGrip.destroy();
        contributorGrip = null;
        contributor.destroy();
        contributor = null;
      }
      if (gameGravity && !initialCount) {
        // Full third-donor handoff: the moving worker's body is removed above,
        // then exactly its conserved material enters the still-incomplete span.
        const admitted = bearing + (fromEnd ? -1 : 1);
        stations.set(admitted, position(admitted));
        physics.sync(stations, supportNear, false, retries, new Map([[admitted, 1]]));
        let admittedStableTime = 0;
        for (let frame = 0; frame < Math.ceil(12 / stepTime) && admittedStableTime < 0.2; frame++) {
          physics.update(stepTime);
          world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
          for (const entity of root.children) {
            entity.rigidbody.sync();
          }
          admittedStableTime = physics.getPlacementStatus(admitted) === "stable" ? admittedStableTime + stepTime : 0;
        }
        assert.ok(admittedStableTime >= 0.2, "admitted compound tissue must validate continuously within its12-second real timeout");
        assert.deepEqual(physics.getFailedStations(), [], "third material admission must not silently invert its predecessors");
        assert.equal(physics.getPlacementStatus(admitted), "stable", "third donor must be native-stable after actual redistribution and solver steps: " + JSON.stringify({
          pose:physics.getPose(admitted),
          up:physics.getEntity(admitted).up,
          v:physics.getEntity(admitted).rigidbody.linearVelocity,
          w:physics.getEntity(admitted).rigidbody.angularVelocity,
        }));
        assert.ok(physics.getPose(admitted).position.y > floorHeight + 0.6, "the partial three-donor structure must carry its own new material above the lower channel");
      }
      if (length === 3) {
        assert.ok(physics.getEntity(1).up.y > 0.8, "the partial predecessor must present a traversable top for the next contact: " + JSON.stringify({
          up:physics.getEntity(1).up,
          pose:physics.getPose(1),
        }));
        assert.ok(physics.update().get(1).position.y > 1.5, "temporary contact-face bending supports the next contributor above the low path");
        assert.ok(physics.update().get(1).position.y > 0.35, "ground prevents tissue from falling through");
      } else {
        for (let station = 1; station < length - 1; station++) {
          stations.set(station, position(station));
          physics.sync(stations, supportNear, false, retries, anticipating ? new Map([[bearing, fromEnd ? -1 : 1]]) : new Map());
          const donated = root.children.find((entity) => entity.name.endsWith(` ${station}`));
          if (voidGround) {
            assert.equal(physics.getPose(station).linkedPrevious, true, "void donation must begin at its real linked predecessor, not at a hovering map target");
          } else {
            assert.ok(donated.getPosition().y > floorHeight, "donations cannot spawn below ground");
          }
          for (let frame = 0; frame < 265 * frameScale; frame++) {
            physics.update(stepTime);
            world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
            for (const entity of root.children) {
              entity.rigidbody.sync();
            }
          }
          if (anticipating && station === 3) {
            let stableTime = 0;
            for (let frame = 0; frame < Math.ceil(12 / stepTime) && stableTime < 0.2; frame++) {
              let ready = true;
              for (const index of stations.keys()) {
                ready &&= physics.isLoadReady(index);
              }
              stableTime = ready ? stableTime + stepTime : 0;
              if (stableTime < 0.2) {
                physics.update(stepTime);
                world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
                for (const entity of root.children) {
                  entity.rigidbody.sync();
                }
              }
            }
            assert.ok(stableTime >= 0.2, "prepared structure must reach a continuous native validation interval within its actual timeout");
            for (const index of stations.keys()) {
              assert.equal(physics.isLoadReady(index), true, "actual prepared four-mass native truss can accept the next load: " + index + JSON.stringify({
                up:physics.getEntity(index).up,
                v:physics.getEntity(index).rigidbody.linearVelocity,
                w:physics.getEntity(index).rigidbody.angularVelocity,
              }));
            }
          }
        }
      }
      if (length === 6 && !anticipating && !retry && !initialCount) {
        const tip = physics.getEntity(length - 2);
        for (let frame = 0; frame < 180 * frameScale; frame++) {
          // Exceed the temporary tissue's finite bending capacity. It must
          // fold to the actual ground instead of forming an infinite beam.
          tip.rigidbody.applyForce(new pc.Vec3(0, gravityY * 200, 0));
          physics.update(stepTime);
          world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
          for (const entity of root.children) {
            entity.rigidbody.sync();
          }
        }
        for (let index = 0; index < dispatcher.getNumManifolds(); index++) {
          touchedGround ||= dispatcher.getManifoldByIndexInternal(index).getNumContacts() > 0;
        }
        assert.ok(touchedGround, "overloaded tissue must make native collision contact with the real terrain");
        assert.ok(physics.getPose(length - 2).position.y < floorHeight + 0.5, "an overloaded incomplete span must sag to real ground");
        assert.ok(physics.getPose(length - 2).position.y > floorHeight - 0.1, "real terrain must stop the overloaded tissue");
        assert.ok(constraints.size >= 3, "overload cannot sever the real adhesive bank attachment");

        return;
      }
      const finalStation = fromEnd ? 0 : length - 1;
      stations.set(finalStation, position(finalStation));
      const preserved = root.children[0];
      preserved.rigidbody.linearVelocity = new pc.Vec3(0.2, 0.1, 0);
      preserved.rigidbody.angularVelocity = new pc.Vec3(0, 0, 0.1);
      physics.sync(stations, (station) => station < 0 || station >= length, true, retries);
      assert.ok(preserved.rigidbody.linearVelocity.distance(new pc.Vec3(0.2, 0.1, 0)) < 1e-6);
      assert.ok(preserved.rigidbody.angularVelocity.distance(new pc.Vec3(0, 0, 0.1)) < 1e-6);
      assert.ok(deckConstraintCount() <= length * 3);
      if (physics.connected) {
        const tip = physics.getEntity(finalStation);
        for (const across of [-0.78, 0.78]) {
          const actual = tip.getWorldTransform().transformPoint(position(fromEnd ? -0.5 : 0.5, 0, across));
          const bankEdge = stations.get(finalStation).clone().add(position(fromEnd ? -0.5 : 0.5, -0.13, across));
          assert.ok(actual.distance(bankEdge) < 0.16, "immediate connection still requires actual paired bank contact");
        }
      } else {
        assert.match(physics.status, /seeking bank/, "supplied mass alone is not a bank contact");
        assert.equal(physics.update().get(finalStation).connected, false);
      }
      assert.equal(physics.settled, false);
      let reached = false;
      for (let frame = 0; frame < 2400 * frameScale; frame++) {
        physics.update(stepTime);
        world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
        for (const entity of root.children) {
          entity.rigidbody.sync();
        }
        if (deckConstraintCount() === (length + 1) * 2) {
          reached = true;
          break;
        }
      }
      assert.ok(reached, `tip should reach the opposite bank through forces: ${physics.status} braces=${JSON.stringify(physics.getPose(0).braces)} ${JSON.stringify([...physics.update().values()].map((pose) => ({
        p: pose.position,
        end: pose.end,
      })))}`);
      for (let frame = 0; frame < 1200 && !physics.settled; frame++) {
        physics.update(stepTime);
        world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
        for (const entity of root.children) {
          entity.rigidbody.sync();
        }
      }
      assert.equal(physics.settled, true, "bank-supported suspension must settle into a usable slope");
      const middle = Math.floor(length / 2);
      for (let frame = 0; frame < 1200 * frameScale; frame++) {
        physics.update(stepTime);
        world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
        for (const entity of root.children) {
          entity.rigidbody.sync();
        }
      }
      const unloaded = physics.update().get(middle).position.y;
      assert.ok(unloaded < 1.95, "completed chain must sag under its own weight without a straightening servo");
      const load = new Entity("Suspension test load");
      root.addChild(load);
      load.setPosition(position(fromEnd ? 0 : length - 1, 2.8, 0.3));
      load.addComponent("collision", {
        halfExtents: new pc.Vec3(0.22, 0.22, 0.22),
      });
      load.addComponent("rigidbody", {
        mass: 80,
        linearDamping: 0.6,
        angularDamping: 0.8,
      });
      // The hero stays upright; a freely rolling crate is not a walking load.
      const lockedRotation = new Ammo.btVector3(0, 0, 0);
      load.rigidbody.body.setAngularFactor(lockedRotation);
      load.rigidbody.body.setFriction(0.85);
      Ammo.destroy(lockedRotation);
      let deflected = false;
      for (let frame = 0; frame < 600 * frameScale; frame++) {
        physics.update(stepTime);
        world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
        for (const entity of root.children) {
          entity.rigidbody.sync();
        }
        deflected ||= physics.update(0).get(middle).position.y < unloaded - 0.015;
      }
      assert.ok(deflected, "a real colliding load must deflect the suspended deck");
      assert.ok(load.getPosition().y > (voidGround ? 0 : floorHeight + 0.5), "the suspended deck must carry its load above the ground");
      for (let station = 0; station < length; station++) {
        const body = physics.getEntity(station);
        assert.ok(body.up.y > 0.85, "hero-mass load must retain a climbable physical deck slope");
        if (station < length - 1) {
          const left = physics.getPose(station).end;
          const right = physics.getPose(station + 1).start;
          assert.ok(left.distance(right) < 0.12, "loaded tension joints cannot stretch into a step-sized deck gap");
        }
      }
      load.destroy();
      world.stepSimulation(stepTime, Math.ceil(stepTime * 60), 1 / 60);
      physics.sync(stations, () => false, false, retries);
      assert.equal(deckConstraintCount(), (length - 1) * 3, "lost bank removes world pins while incomplete material retains finite bending patches");
    } finally {
      contributorGrip?.destroy();
      contributor?.destroy();
      physics.destroy();
      bank?.destroy();
      if (!voidGround) {
        world.removeRigidBody(floor);
      }
      for (const allocation of [floor, floorMotion, floorShape, floorTransform]) {
        Ammo.destroy(allocation);
      }
      globalThis.Ammo = previous;
      for (const allocation of [world, solver, broadphase, dispatcher, configuration]) {
        Ammo.destroy(allocation);
      }
    }
  });
}

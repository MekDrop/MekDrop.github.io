import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";
import { Mat4 } from "playcanvas/build/playcanvas/src/core/math/mat4.js";
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";
import { BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_USER_1, BODYGROUP_USER_2 } from "playcanvas/build/playcanvas/src/framework/components/rigid-body/constants.js";
import { JOINTTYPE_6DOF, MOTION_LOCKED, MOTION_LIMITED } from "playcanvas/build/playcanvas/src/framework/components/joint/constants.js";

/**
 * Two inextensible thin sections per leaf, with a fixed base and sprung folds.
 * This isolated Ammo world only simulates the nearby, individually rendered paper.
 */
export class FlowerPaperSimulation {
  /**
   * @type {AmmoPhysicsWorld}
   */
  #world = new AmmoPhysicsWorld();
  /**
   * @type {Set<import("playcanvas").PhysicsBody>}
   */
  #bodies = new Set();
  /**
   * @type {Set<import("playcanvas").PhysicsJoint>}
   */
  #joints = new Set();
  /**
   * @type {Map<import("playcanvas").PhysicsBody, ReturnType<AmmoPhysicsWorld["createShape"]>>}
   */
  #shapes = new Map();
  /**
   * @type {import("playcanvas").PhysicsBody[]}
   */
  #feet = [];
  /**
   * @type {Vec3[]}
   */
  #previousFeet = [new Vec3(0, -1000, 0), new Vec3(0, -1000, 0)];
  /**
   * @type {number}
   */
  #pendingDelta = 0;
  /**
   * @type {Set<ReturnType<FlowerPaperSimulation["add"]>>}
   */
  #sheets = new Set();
  /**
   * @type {Set<ReturnType<FlowerPaperSimulation["add"]>>}
   */
  #pressed = new Set();
  /**
   * @type {number}
   */
  #stationaryTime = 0;
  /**
   * @type {Quat}
   */
  #previousFacing = new Quat();

  constructor() {
    this.#world.setGravity(Vec3.ZERO);
    this.#world.nativeWorld.getSolverInfo().set_m_numIterations(30);
    for (let index = 0; index < 2; index++) {
      this.#feet.push(this.#body(BODYTYPE_KINEMATIC, { type: "box", halfExtents: new Vec3(0.095, 0.3, 0.13) }, this.#previousFeet[index], Quat.IDENTITY));
    }
  }

  /**
   * @param {string} type
   * @param {{type: string, radius?: number, halfExtents?: Vec3}} description
   * @param {Vec3} position
   * @param {Quat} rotation
   * @returns {import("playcanvas").PhysicsBody}
   */
  #body(type, description, position, rotation) {
    const shape = this.#world.createShape(description);
    const body = this.#world.createBody({ type, shape, mass: type === BODYTYPE_DYNAMIC ? 0.001 : 0, position, rotation });
    const dynamic = type === BODYTYPE_DYNAMIC;
    this.#world.addBody(body, dynamic ? BODYGROUP_USER_1 : BODYGROUP_USER_2, dynamic ? BODYGROUP_USER_2 : BODYGROUP_USER_1);
    body.setDamping(0.72, 0.8);
    body.setFriction(0.65);
    body.nativeBody.setSleepingThresholds(0.0005, 0.0005);
    this.#bodies.add(body);
    this.#shapes.set(body, shape);
    return body;
  }

  /**
   * @param {import("playcanvas").PhysicsBody} bodyA
   * @param {import("playcanvas").PhysicsBody} bodyB
   * @param {number} offsetA
   * @param {number} offsetB
   * @returns {import("playcanvas").PhysicsJoint}
   */
  #fold(bodyA, bodyB, offsetA, offsetB) {
    const joint = this.#world.createJoint({
      type: JOINTTYPE_6DOF, bodyA, bodyB,
      frameA: new Mat4().setTranslate(offsetA, 0, 0), frameB: new Mat4().setTranslate(offsetB, 0, 0),
      enableCollision: false,
      settings: {
        linearMotionX: MOTION_LOCKED, linearMotionY: MOTION_LOCKED, linearMotionZ: MOTION_LOCKED,
        linearLimitsX: new Vec3(), linearLimitsY: new Vec3(), linearLimitsZ: new Vec3(),
        angularMotionX: MOTION_LOCKED, angularMotionY: MOTION_LOCKED, angularMotionZ: MOTION_LIMITED,
        angularLimitsX: new Vec3(), angularLimitsY: new Vec3(), angularLimitsZ: new Vec3(-82, 45),
        linearStiffness: new Vec3(), linearDamping: new Vec3(1, 1, 1), linearEquilibrium: new Vec3(),
        angularStiffness: new Vec3(0, 0, 0.15), angularDamping: new Vec3(1, 1, 0.85), angularEquilibrium: new Vec3(),
      },
    });
    this.#joints.add(joint);
    return joint;
  }

  /**
   * @param {Vec3} position
   * @param {number} radius
   * @returns {import("playcanvas").PhysicsBody}
   */
  addSurface(position, radius) {
    return this.#body(BODYTYPE_KINEMATIC, { type: "box", halfExtents: new Vec3(radius, 0.04, radius) },
      new Vec3(position.x, position.y - 0.04, position.z), Quat.IDENTITY);
  }

  /**
   * @param {import("playcanvas").PhysicsBody} body
   * @param {Vec3} root
   */
  moveSurface(body, root) {
    const previous = new Vec3();
    const position = new Vec3(root.x, root.y - 0.04, root.z);
    body.getTransform(previous, new Quat());
    if (previous.distance(position) > 0.1) {
      body.setTransform(position, Quat.IDENTITY);
      body.nativeBody.setInterpolationWorldTransform(body.nativeBody.getWorldTransform());
    }
    body.setKinematicTarget(position, Quat.IDENTITY);
  }

  /**
   * @param {import("playcanvas").PhysicsBody} body
   */
  removeSurface(body) { this.#removeBody(body); }

  /**
   * @param {import("playcanvas").PhysicsBody} body
   */
  #removeBody(body) {
    this.#world.removeBody(body); this.#world.destroyBody(body); this.#bodies.delete(body);
    this.#world.destroyShape(this.#shapes.get(body)); this.#shapes.delete(body);
  }

  /**
   * @param {{position: Vec3, rotation: Quat, length: number, width: number}} definition
   * @returns {{anchor: import("playcanvas").PhysicsBody, links: import("playcanvas").PhysicsBody[], joints: import("playcanvas").PhysicsJoint[], length: number, rotation: Quat}}
   */
  add({ position, rotation, length, width }) {
    const anchor = this.#body(BODYTYPE_KINEMATIC, { type: "sphere", radius: 0.001 }, position, rotation);
    // Anchors support the sheet but do not collide with the soles.
    this.#world.removeBody(anchor);
    this.#world.addBody(anchor, BODYGROUP_USER_1, 0);
    const links = [];
    for (let index = 0; index < 2; index++) {
      const center = rotation.transformVector(new Vec3(length * (index + 0.5) / 2, 0, 0)).add(position);
      links.push(this.#body(BODYTYPE_DYNAMIC, { type: "box", halfExtents: new Vec3(length / 4, 0.003, width / 2) }, center, rotation));
    }
    const joints = [this.#fold(anchor, links[0], 0, -length / 4), this.#fold(links[0], links[1], length / 4, -length / 4)];
    const sheet = { anchor, links, joints, length, rotation: rotation.clone() };
    this.#sheets.add(sheet);
    return sheet;
  }

  /**
   * @param {ReturnType<FlowerPaperSimulation["add"]>} sheet
   * @param {Vec3} position
   */
  moveAttachment(sheet, position) {
    const previous = new Vec3();
    sheet.anchor.getTransform(previous, new Quat());
    if (this.#pressed.has(sheet) && previous.distance(position) < 0.1) { return; }
    if (previous.distance(position) > 0.1) {
      // Island/spawn teleports carry the entire articulated sheet; they are
      // not impacts delivered through the attachment in one fixed timestep.
      const delta = position.clone().sub(previous);
      for (const link of sheet.links) {
        const current = new Vec3(), rotation = new Quat();
        link.getTransform(current, rotation);
        link.setTransform(current.add(delta), rotation);
        link.nativeBody.setInterpolationWorldTransform(link.nativeBody.getWorldTransform());
        link.nativeBody.getMotionState().setWorldTransform(link.nativeBody.getWorldTransform());
      }
      sheet.anchor.setTransform(position, sheet.rotation);
      sheet.anchor.nativeBody.setInterpolationWorldTransform(sheet.anchor.nativeBody.getWorldTransform());
    }
    sheet.anchor.setKinematicTarget(position, sheet.rotation);
  }

  /**
   * Recover an exact render chain from Ammo angles. Solver penetration recovery
   * can briefly stretch a joint; forward kinematics keeps the paper seam sewn.
   * @param {ReturnType<FlowerPaperSimulation["add"]>} sheet
   * @returns {Array<{position: Vec3, rotation: Quat}>}
   */
  poses(sheet) {
    let base = new Vec3();
    sheet.anchor.getTransform(base, new Quat());
    const poses = [];
    for (const link of sheet.links) {
      const position = new Vec3(), rotation = new Quat();
      link.getTransform(position, rotation);
      const half = rotation.transformVector(new Vec3(sheet.length / 4, 0, 0));
      position.copy(base).add(half);
      base = position.clone().add(half);
      poses.push({ position, rotation });
    }
    return poses;
  }

  /**
   * @param {ReturnType<FlowerPaperSimulation["add"]>} sheet
   */
  remove(sheet) {
    this.#sheets.delete(sheet); this.#pressed.delete(sheet);
    for (const joint of sheet.joints) { this.#world.destroyJoint(joint); this.#joints.delete(joint); }
    for (const body of [sheet.anchor, ...sheet.links]) {
      this.#removeBody(body);
    }
  }

  /**
   * @param {number} deltaTime
   * @param {Vec3[]} feet
   * @param {Quat} facing
   */
  step(deltaTime, feet, facing) {
    const moved = feet.some(/**
     *
     * @param {Vec3} foot
     * @param {number} index
     */
    (foot, index) => foot.distance(this.#previousFeet[index]) > 0.0001) ||
      Math.abs(facing.dot(this.#previousFacing)) < 0.999999;
    if (moved) {
      this.#stationaryTime = 0;
      for (const sheet of this.#pressed) {
        for (const link of sheet.links) { link.nativeBody.forceActivationState(1); link.activate(); }
      }
      this.#pressed.clear();
    } else { this.#stationaryTime += deltaTime; }
    if (this.#stationaryTime > 0.75) {
      const inverse = facing.clone().invert();
      for (const sheet of this.#sheets) {
        if (this.#pressed.has(sheet)) { continue; }
        const loaded = this.poses(sheet).some(/**
         *
         * @param {{position: Vec3}} options
         * @param {Vec3} options.position
         */
        ({ position }) => feet.some(/**
         *
         * @param {Vec3} foot
         */
        (foot) => {
          const local = inverse.transformVector(position.clone().sub(foot));
          // Include the full attached sheet: a sole can load its inner edge
          // while both section centers remain outside the footprint.
          return Math.abs(local.x) < 0.095 + sheet.length && Math.abs(local.z) < 0.13 + sheet.length &&
            Math.abs(position.y - (foot.y - 0.3)) < 0.2;
        }));
        if (!loaded) { continue; }
        // Bullet's disabled simulation state holds settled, loaded paper. The
        // springs resume when the sole moves; free petals continue recovering.
        for (const link of sheet.links) {
          link.setLinearVelocity(Vec3.ZERO); link.setAngularVelocity(Vec3.ZERO);
          link.nativeBody.forceActivationState(5);
        }
        this.#pressed.add(sheet);
      }
    }
    const fixed = 1 / 120;
    this.#pendingDelta = Math.min(this.#pendingDelta + Math.max(0, deltaTime), 4 * fixed);
    const count = Math.floor(this.#pendingDelta / fixed);
    this.#pendingDelta -= count * fixed;
    for (let index = 0; index < 2; index++) {
      if (this.#previousFeet[index].distance(feet[index]) > 0.35) {
        this.#feet[index].setTransform(feet[index], facing);
        this.#feet[index].nativeBody.setInterpolationWorldTransform(this.#feet[index].nativeBody.getWorldTransform());
        this.#previousFeet[index].copy(feet[index]);
      }
    }
    for (let step = 1; step <= count; step++) {
      for (let index = 0; index < 2; index++) {
        const position = new Vec3().lerp(this.#previousFeet[index], feet[index], step / count);
        this.#feet[index].setKinematicTarget(position, facing);
      }
      this.#world.step(fixed, 1, fixed);
    }
    if (count) { for (let index = 0; index < 2; index++) { this.#previousFeet[index].copy(feet[index]); } }
    this.#previousFacing.copy(facing);
  }

  destroy() {
    for (const joint of this.#joints) { this.#world.destroyJoint(joint); }
    for (const body of this.#bodies) { this.#world.removeBody(body); this.#world.destroyBody(body); }
    for (const shape of this.#shapes.values()) { this.#world.destroyShape(shape); }
    this.#world.destroy();
    this.#joints.clear(); this.#bodies.clear(); this.#shapes.clear();
  }
}

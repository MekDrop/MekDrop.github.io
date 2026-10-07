import { Mat4 } from "playcanvas/build/playcanvas/src/core/math/mat4.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";
import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
import { BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_USER_1, BODYGROUP_USER_2 } from "playcanvas/build/playcanvas/src/framework/components/rigid-body/constants.js";
import { JOINTTYPE_6DOF, MOTION_LOCKED, MOTION_LIMITED } from "playcanvas/build/playcanvas/src/framework/components/joint/constants.js";
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";

/**
 * @typedef {{position: {x: number, y: number, z: number}, pivotHeight: number, radius: number}} FlowerDefinition
 * @typedef {{body: import("playcanvas").PhysicsBody, anchor: import("playcanvas").PhysicsBody, joint: import("playcanvas").PhysicsJoint, position: Vec3, offset: number, hidden: boolean}} SimulatedFlower
 */

/**
 * An isolated engine physics world; it has no renderer or DOM dependencies.
 */
export class FlowerPhysicsSimulation {
  /**
   * @type {AmmoPhysicsWorld}
   */
  #world;
  /**
   * @type {Set<import("playcanvas").PhysicsBody>}
   */
  #bodies = new Set();
  /**
   * @type {Set<import("playcanvas").PhysicsBody>}
   */
  #activeBodies = new Set();
  /**
   * @type {Set<import("playcanvas").PhysicsJoint>}
   */
  #joints = new Set();
  /**
   * @type {Set<ReturnType<AmmoPhysicsWorld["createShape"]>>}
   */
  #shapes = new Set();
  /**
   * @type {SimulatedFlower[]}
   */
  #flowers = [];
  /**
   * @type {import("playcanvas").PhysicsBody[]}
   */
  #feet = [];
  /**
   * @type {Vec3}
   */
  #position = new Vec3();
  /**
   * @type {Quat}
   */
  #rotation = new Quat();
  /**
   * @type {Quat}
   */
  #identity = new Quat();

  /**
   * @param {FlowerDefinition[]} definitions
   * @param {number} gravity
   */
  constructor(definitions, gravity = -9.81) {
    this.#world = new AmmoPhysicsWorld();
    this.#world.setGravity(new Vec3(0, gravity, 0));
    for (const definition of definitions) {
      const position = new Vec3(definition.position.x, definition.position.y, definition.position.z);
      const body = this.#createBody(BODYTYPE_DYNAMIC, 0.008,
        { type: "cylinder", radius: definition.radius * 0.72, height: 0.035, axis: 1 },
        new Vec3(position.x, position.y + definition.pivotHeight, position.z), BODYGROUP_USER_1, BODYGROUP_USER_2);
      body.setFriction(0.75);
      body.setDamping(0.58, 0.7);
      const anchor = this.#createBody(BODYTYPE_KINEMATIC, 0,
        { type: "sphere", radius: 0.01 }, position, BODYGROUP_USER_1, 0);
      const joint = this.#world.createJoint({
        type: JOINTTYPE_6DOF, bodyA: body, bodyB: anchor,
        frameA: new Mat4().setTranslate(0, -definition.pivotHeight, 0), frameB: new Mat4(),
        enableCollision: false,
        settings: {
          linearMotionX: MOTION_LOCKED, linearMotionY: MOTION_LIMITED, linearMotionZ: MOTION_LOCKED,
          linearLimitsX: new Vec3(), linearLimitsY: new Vec3(-0.08, 0.01), linearLimitsZ: new Vec3(),
          angularMotionX: MOTION_LIMITED, angularMotionY: MOTION_LOCKED, angularMotionZ: MOTION_LIMITED,
          angularLimitsX: new Vec3(-76, 76), angularLimitsY: new Vec3(), angularLimitsZ: new Vec3(-76, 76),
          linearStiffness: new Vec3(0, 12, 0), linearDamping: new Vec3(1, 0.86, 1), linearEquilibrium: new Vec3(),
          angularStiffness: new Vec3(0.06, 0, 0.06), angularDamping: new Vec3(0.74, 1, 0.74), angularEquilibrium: new Vec3(),
        },
      });
      this.#joints.add(joint);
      this.#flowers.push({ body, anchor, joint, position, offset: 0, hidden: false });
    }
    for (let index = 0; index < 2; index++) {
      const foot = this.#createBody(BODYTYPE_KINEMATIC, 0,
        { type: "sphere", radius: 0.17 }, new Vec3(0, -1000, 0), BODYGROUP_USER_2, BODYGROUP_USER_1);
      foot.setFriction(0.8);
      this.#feet.push(foot);
    }
  }

  destroy() {
    for (const joint of this.#joints) { this.#world.destroyJoint(joint); }
    for (const body of this.#activeBodies) { this.#world.removeBody(body); }
    for (const body of this.#bodies) { this.#world.destroyBody(body); }
    for (const shape of this.#shapes) { this.#world.destroyShape(shape); }
    this.#world.destroy();
    this.#joints.clear();
    this.#bodies.clear();
    this.#activeBodies.clear();
    this.#shapes.clear();
    this.#flowers = [];
    this.#feet = [];
  }

  /**
   * @param {string} type
   * @param {number} mass
   * @param {{type: string, radius: number, height?: number, axis?: number}} description
   * @param {Vec3} position
   * @param {number} group
   * @param {number} mask
   * @returns {import("playcanvas").PhysicsBody}
   */
  #createBody(type, mass, description, position, group, mask) {
    const shape = this.#world.createShape(description);
    const body = this.#world.createBody({ type, mass, shape, position, rotation: this.#identity });
    this.#world.addBody(body, group, mask);
    this.#bodies.add(body);
    this.#activeBodies.add(body);
    this.#shapes.add(shape);
    return body;
  }

  /**
   * @param {{deltaTime: number, offsets: Float32Array, hidden: Uint8Array, feet: Float32Array}} state
   * @returns {Float32Array}
   */
  step({ deltaTime, offsets, hidden, feet }) {
    for (let index = 0; index < this.#flowers.length; index++) {
      const flower = this.#flowers[index];
      if (hidden[index] && !flower.hidden) {
        this.#world.destroyJoint(flower.joint);
        this.#joints.delete(flower.joint);
        this.#world.removeBody(flower.body);
        this.#world.removeBody(flower.anchor);
        this.#activeBodies.delete(flower.body);
        this.#activeBodies.delete(flower.anchor);
        flower.hidden = true;
      }
      if (flower.hidden) { continue; }
      const delta = offsets[index] - flower.offset;
      if (delta !== 0) {
        flower.body.getTransform(this.#position, this.#rotation);
        this.#position.y += delta;
        flower.body.setTransform(this.#position, this.#rotation);
        flower.anchor.setTransform(new Vec3(flower.position.x, flower.position.y + offsets[index], flower.position.z), this.#identity);
        // Island translation moves both joint endpoints; it is not a foot impact.
        flower.anchor.nativeBody.setInterpolationWorldTransform(flower.anchor.nativeBody.getWorldTransform());
        flower.offset = offsets[index];
      }
    }
    for (let index = 0; index < 2; index++) {
      this.#position.set(feet[index * 3], feet[index * 3 + 1], feet[index * 3 + 2]);
      this.#feet[index].setKinematicTarget(this.#position, this.#identity);
    }
    // Decorative springs have a bounded catch-up budget; hero physics is separate.
    this.#world.step(Math.min(deltaTime, 0.1), 4, 1 / 120);
    const transforms = new Float32Array(this.#flowers.length * 7);
    for (let index = 0; index < this.#flowers.length; index++) {
      const flower = this.#flowers[index];
      if (flower.hidden) { continue; }
      flower.body.getTransform(this.#position, this.#rotation);
      transforms.set([this.#position.x, this.#position.y, this.#position.z,
        this.#rotation.x, this.#rotation.y, this.#rotation.z, this.#rotation.w], index * 7);
    }
    return transforms;
  }
}

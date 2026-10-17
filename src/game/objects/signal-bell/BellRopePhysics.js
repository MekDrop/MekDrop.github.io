import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";
import { Mat4 } from "playcanvas/build/playcanvas/src/core/math/mat4.js";
import { BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_USER_5, BODYGROUP_STATIC } from "playcanvas/build/playcanvas/src/framework/components/rigid-body/constants.js";
import { JOINTTYPE_BALL } from "playcanvas/build/playcanvas/src/framework/components/joint/constants.js";

/**
 * Articulated rope in the game's Ammo world. Only its attachment and a held
 * grip are kinematic; gravity, contact and joint constraints move every link.
 */
export class BellRopePhysics {
  /**
   * @type {import("playcanvas").PhysicsWorld}
   */
  #world;
  /**
   * @type {import("playcanvas").PhysicsBody[]}
   */
  #bodies = [];
  /**
   * @type {ReturnType<import("playcanvas").PhysicsWorld["createShape"]>[]}
   */
  #shapes = [];
  /**
   * @type {import("playcanvas").PhysicsJoint[]}
   */
  #joints = [];
  /**
   * @type {import("playcanvas").PhysicsJoint|null}
   */
  #gripJoint = null;
  /**
   * @type {import("playcanvas").PhysicsBody}
   */
  #anchor;
  /**
   * @type {import("playcanvas").PhysicsBody}
   */
  #hand;
  /**
   * @type {{body: import("playcanvas").PhysicsBody, length: number}[]}
   */
  #links = [];
  /**
   * @type {Vec3}
   */
  #previousAnchor;

  /**
   * @param {import("playcanvas").PhysicsWorld} world
   * @param {Vec3} position
   * @param {number} scale
   * @param {number} upperLength
   */
  constructor(world, position, scale = 1, upperLength = 0.5) {
    this.#world = world;
    this.#previousAnchor = position.clone();
    this.#anchor = this.#body(BODYTYPE_KINEMATIC, position, 0.005 * scale);
    this.#hand = this.#body(BODYTYPE_KINEMATIC, position, 0.005 * scale);
    let previous = this.#anchor;
    let previousLength = 0;
    let distance = 0;
    for (let index = 0; index < 11; index++) {
      const length = (index < 8 ? upperLength / 8 : 0.18 / 3) * scale;
      const center = position.clone().add(new Vec3(0, -distance - length / 2, 0));
      const body = this.#body(BODYTYPE_DYNAMIC, center, 0.009 * scale, length);
      this.#joints.push(this.#join(previous, body, -previousLength / 2, length / 2));
      this.#links.push({
        body,
        length,
      });
      previous = body;
      previousLength = length;
      distance += length;
    }
  }

  /**
   * @param {string} type
   * @param {Vec3} position
   * @param {number} radius
   * @param {number} length
   * @returns {import("playcanvas").PhysicsBody}
   */
  #body(type, position, radius, length = 0) {
    const shape = this.#world.createShape(length
      ? {
        type: "capsule",
        radius,
        height: length,
        axis: 1,
      }
      : {
        type: "sphere",
        radius,
      });
    shape.setMargin(0.002);
    const body = this.#world.createBody({
      type,
      shape,
      mass: length ? 0.015 : 0,
      position,
      rotation: Quat.IDENTITY,
    });
    // No self-contact or capsule snagging while held. The frame and floor still collide.
    this.#world.addBody(body, BODYGROUP_USER_5, length ? BODYGROUP_STATIC : 0);
    body.setDamping(0.45, 0.55);
    body.setFriction(0.4);
    body.nativeBody.setSleepingThresholds(0.001, 0.001);
    this.#bodies.push(body);
    this.#shapes.push(shape);

    return body;
  }

  /**
   * @param {import("playcanvas").PhysicsBody} bodyA
   * @param {import("playcanvas").PhysicsBody} bodyB
   * @param {number} offsetA
   * @param {number} offsetB
   * @returns {import("playcanvas").PhysicsJoint}
   */
  #join(bodyA, bodyB, offsetA, offsetB) {
    const joint = this.#world.createJoint({
      type: JOINTTYPE_BALL,
      bodyA,
      bodyB,
      frameA: new Mat4().setTranslate(0, offsetA, 0),
      frameB: new Mat4().setTranslate(0, offsetB, 0),
      enableCollision: false,
      settings: { enableLimits: false },
    });
    // A short rope needs tighter positional correction than Bullet's default
    // cone-twist ERP, especially in the game's 60 Hz world with ten iterations.
    joint.nativeJoint.setParam(1, 0.8, 0);

    return joint;
  }

  /**
   * @param {Vec3} anchor
   * @param {Vec3|null} hand
   */
  updateAttachments(anchor, hand = null) {
    const delta = anchor.clone().sub(this.#previousAnchor);
    if (delta.length() > 0.25) {
      // Carry the chain with island/spawn teleports rather than yanking it across the world.
      for (const body of this.#bodies) {
        const position = new Vec3();
        const rotation = new Quat();
        body.getTransform(position, rotation);
        body.setTransform(position.add(delta), rotation);
        body.nativeBody.getMotionState().setWorldTransform(body.nativeBody.getWorldTransform());
        body.setLinearVelocity(Vec3.ZERO);
        body.setAngularVelocity(Vec3.ZERO);
      }
    }
    this.#previousAnchor.copy(anchor);
    this.#anchor.setKinematicTarget(anchor, Quat.IDENTITY);
    if (hand) {
      this.#hand.setKinematicTarget(hand, Quat.IDENTITY);
      if (!this.#gripJoint) {
        this.#hand.setTransform(hand, Quat.IDENTITY);
        this.#hand.nativeBody.setInterpolationWorldTransform(this.#hand.nativeBody.getWorldTransform());
        const link = this.#links[7];
        this.#gripJoint = this.#join(this.#hand, link.body, 0, -link.length / 2);
      }
      for (const { body } of this.#links) {
        body.activate();
      }
    } else {
      this.release();
    }
  }

  release() {
    if (this.#gripJoint) {
      this.#world.destroyJoint(this.#gripJoint);
      this.#gripJoint = null;
    }
  }

  /**
   * @returns {{position: Vec3, rotation: Quat, length: number}[]}
   */
  get transforms() {
    return this.#links.map(BellRopePhysics.#map);
  }

  destroy() {
    this.release();
    for (const joint of this.#joints) {
      this.#world.destroyJoint(joint);
    }
    for (const body of this.#bodies) {
      this.#world.removeBody(body);
      this.#world.destroyBody(body);
    }
    for (const shape of this.#shapes) {
      this.#world.destroyShape(shape);
    }
    this.#joints = [];
    this.#bodies = [];
    this.#shapes = [];
    this.#links = [];
  }

  /**
   * @param {{body: import("playcanvas").PhysicsBody, length: number}} link
   */
  static #map({ body, length }) {
    const position = new Vec3();
    const rotation = new Quat();
    body.getTransform(position, rotation);

    return {
      position,
      rotation,
      length,
    };
  }
}

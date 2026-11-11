import {
  Vec3,
  Quat,
  Mat4,
  Entity,
  BODYTYPE_DYNAMIC,
  BODYTYPE_KINEMATIC,
  BODYGROUP_USER_5,
  BODYGROUP_STATIC,
  BODYGROUP_DYNAMIC,
  BODYGROUP_KINEMATIC,
  JOINTTYPE_BALL,
} from "playcanvas";
import { getAmbientWind } from "../../shared/AmbientWind.js";

/**
 * Leaf-bearing shoots suspended from the living runner in the shared Ammo world.
 * Supported climbing growth stays attached to the pergola; loose growth bends
 * under gravity, wind and contact instead of being animated through the timber.
 */
export class GardenVine {
  /**
   * @type {import("playcanvas").PhysicsWorld}
   */
  #world;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Entity}
   */
  #support;
  /**
   * @type {import("playcanvas").PhysicsBody[]}
   */
  #bodies = [];
  /**
   * @type {import("playcanvas").PhysicsShape[]}
   */
  #shapes = [];
  /**
   * @type {import("playcanvas").PhysicsJoint[]}
   */
  #joints = [];
  /**
   * @type {Array<{anchor: Vec3, previous: Vec3, body: import("playcanvas").PhysicsBody}>}
   */
  #anchors = [];
  /**
   * @type {Array<{body: import("playcanvas").PhysicsBody, stem: Entity, leaf: Entity, length: number}>}
   */
  #links = [];
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {number}
   */
  #scale;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #update;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #render;

  /**
   * @param {import("playcanvas").Application} app
   * @param {Entity} support
   * @param {import("../../../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {string} stemUrl
   * @param {string} leafUrl
   * @param {Vec3[]} attachments Endpoints in the authored model's local frame.
   */
  constructor(app, support, models, stemUrl, leafUrl, attachments) {
    this.#world = app.systems.rigidbody.physicsWorld;
    this.#support = support;
    this.#root = new Entity("Living pergola shoots");
    app.root.addChild(this.#root);
    const scale = support.getWorldTransform().getScale().y;
    this.#scale = scale;
    for (const [index, point] of attachments.entries()) {
      // Continue down the beam face instead of suspending a shoot on an
      // outward arm. Young leaves emerge below the lower timber edge.
      const anchor = point.clone();
      // The scene can use a separate Engine build. Keep vectors in this
      // module's class so Entity's instanceof-based setters accept them.
      const position = support.getWorldTransform().transformPoint(anchor, new Vec3());
      let previous = this.#body(position, 0, scale);
      this.#anchors.push({
        anchor,
        previous: position.clone(),
        body: previous,
      });
      const length = [0.045, 0.032][index] * scale;
      for (let step = 0; step < 6; step++) {
        const center = position.clone().add(new Vec3(0, -(step + 0.5) * length, 0));
        const body = this.#body(center, length, scale, step >= 3);
        const joint = this.#world.createJoint({
          type: JOINTTYPE_BALL,
          bodyA: previous,
          bodyB: body,
          frameA: new Mat4().setTranslate(0, step ? -length / 2 : 0, 0),
          frameB: new Mat4().setTranslate(0, length / 2, 0),
          enableCollision: false,
          settings: { enableLimits: false },
        });
        this.#joints.push(joint);
        // Single-node GLBs keep Blender's axis conversion on their root.
        // Animate wrappers so world rotations never erase that authored pose.
        const stem = new Entity("Vine stem");
        const leaf = new Entity("Vine leaf");
        stem.addChild(models.instantiate(stemUrl));
        leaf.addChild(models.instantiate(leafUrl));
        this.#root.addChild(stem);
        this.#root.addChild(leaf);
        const leafScale = scale * [0.4, 0.65, 0.5, 0.7, 0.55, 0.35][step];
        leaf.setLocalScale(leafScale, leafScale, leafScale);
        // The authored stem starts at its top and runs down local -Y.
        stem.setLocalScale(scale, length, scale);
        this.#links.push({
          body,
          stem,
          leaf,
          length,
        });
        previous = body;
      }
    }
    this.#update = app.on("update", this.#sync, this);
    this.#render = app.on("prerender", this.#renderLinks, this);
    this.#renderLinks();
  }

  /**
   * @param {Vec3} position
   * @param {number} length
   * @param {number} scale
   * @param {boolean} [foliage]
   * @returns {import("playcanvas").PhysicsBody}
   */
  #body(position, length, scale, foliage = false) {
    const radius = (foliage ? 0.13 : 0.025) * scale;
    const shape = this.#world.createShape({
      type: "capsule",
      radius,
      height: Math.max(radius * 2, length),
      axis: 1,
    });
    shape.setMargin(0.001 * scale);
    const body = this.#world.createBody({
      type: length ? BODYTYPE_DYNAMIC : BODYTYPE_KINEMATIC,
      shape,
      mass: length ? 0.004 : 0,
      position,
      rotation: Quat.IDENTITY,
    });
    this.#world.addBody(body, BODYGROUP_USER_5,
      length ? BODYGROUP_STATIC | BODYGROUP_DYNAMIC | BODYGROUP_KINEMATIC : 0);
    body.setDamping(0.65, 0.75);
    body.setFriction(0.35);
    this.#bodies.push(body);
    this.#shapes.push(shape);

    return body;
  }

  /**
   * @param {number} deltaTime
   */
  #sync(deltaTime) {
    this.#elapsed += deltaTime;
    this.#syncAttachments();
    const wind = getAmbientWind(this.#elapsed);
    const force = new Vec3(wind.direction.x, 0, wind.direction.z).mulScalar(wind.speed * 0.006);
    for (const link of this.#links) {
      link.body.activate();
      link.body.applyForce(force, Vec3.ZERO);
    }
  }

  #syncAttachments() {
    for (const anchor of this.#anchors) {
      const position = this.#support.getWorldTransform().transformPoint(anchor.anchor, new Vec3());
      const delta = position.clone().sub(anchor.previous);
      if (delta.length() > 0.25) {
        // Translate the whole shoot on island teleports without stretching joints.
        const first = this.#anchors.indexOf(anchor) * 6;
        for (const link of this.#links.slice(first, first + 6)) {
          const p = new Vec3();
          const q = new Quat();
          link.body.getTransform(p, q);
          link.body.setTransform(p.add(delta), q);
          link.body.nativeBody.getMotionState().setWorldTransform(link.body.nativeBody.getWorldTransform());
          link.body.setLinearVelocity(Vec3.ZERO);
          link.body.setAngularVelocity(Vec3.ZERO);
        }
      }
      anchor.body.setKinematicTarget(position, Quat.IDENTITY);
      anchor.previous.copy(position);
    }
  }

  #renderLinks() {
    // Match the final model pose after island movement, physics and other
    // update listeners. The visible join must use this frame's transform.
    this.#syncAttachments();
    this.#syncLinks();
  }

  #syncLinks() {
    for (const [chain, anchor] of this.#anchors.entries()) {
      const links = this.#links.slice(chain * 6, chain * 6 + 6);
      const transforms = [];
      for (const link of links) {
        const position = new Vec3();
        const rotation = new Quat();
        link.body.getTransform(position, rotation);
        transforms.push({
          position,
          rotation,
          length: link.length,
        });
      }
      // Bullet joints permit small residuals. Shared visual endpoints close
      // those gaps without changing the engine's simulated bend or motion.
      const points = [anchor.previous.clone()];
      for (let index = 1; index < transforms.length; index++) {
        points.push(GardenVine.#endpoint(transforms[index - 1], -1)
          .add(GardenVine.#endpoint(transforms[index], 1)).mulScalar(0.5));
      }
      points.push(GardenVine.#endpoint(transforms.at(-1), -1));
      for (const [index, link] of links.entries()) {
        const top = points[index];
        const bottom = points[index + 1];
        const direction = top.clone().sub(bottom);
        const length = direction.length();
        const rotation = new Quat().setFromDirections(Vec3.UP, direction.normalize());
        link.stem.setPosition(top);
        link.stem.setRotation(rotation);
        link.stem.setLocalScale(this.#scale, length, this.#scale);
        link.leaf.setPosition(top.clone().add(bottom).mulScalar(0.5));
        link.leaf.setRotation(rotation.clone().mul(this.#support.getRotation())
          .mul(new Quat().setFromEulerAngles(8, [-22, 8, -12, 20, -8, 4][index], [-35, 22, -18, 28, -28, 8][index])));
      }
    }
  }

  /**
   * @param {{position: Vec3, rotation: Quat, length: number}} transform
   * @param {number} sign
   * @returns {Vec3}
   */
  static #endpoint({ position, rotation, length }, sign) {
    return position.clone().add(rotation.transformVector(new Vec3(0, sign * length / 2, 0)));
  }

  destroy() {
    this.#update.off();
    this.#render.off();
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
    this.#root.destroy();
  }

  /**
   * @returns {Entity}
   */
  get entity() {
    return this.#root;
  }
}

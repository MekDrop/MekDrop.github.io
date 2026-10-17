import { BellRopePhysics } from "./BellRopePhysics.js";

/**
 * Owns the bell's simulated string and its reused authored rope meshes.
 */
export class SignalBellRope {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #bowl;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #segments = [];
  /**
   * @type {import("playcanvas").Entity}
   */
  #knot;
  /**
   * @type {BellRopePhysics}
   */
  #physics;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #update;
  /**
   * @type {number}
   */
  #scale;
  /**
   * @type {(()=>import("playcanvas").Vec3|null)|null}
   */
  #hand = null;
  /**
   * @type {boolean}
   */
  #grasped = false;

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} model
   */
  constructor(pc, app, model) {
    this.#pc = pc;
    this.#bowl = model.findByName("Signal bell bronze bowl clapper and rope");
    this.#scale = model.getWorldTransform().getScale().y;
    this.#root = new pc.Entity("Signal bell simulated rope");
    app.root.addChild(this.#root);
    const template = model.findByName("Bell pull rope");
    this.#knot = model.findByName("Bell rope knot").clone();
    this.#root.addChild(this.#knot);
    for (let index = 0; index < 11; index++) {
      const segment = template.clone();
      segment.name = `Rope link ${index}`;
      segment.enabled = true;
      this.#root.addChild(segment);
      this.#segments.push(segment);
    }
    template.enabled = false;
    model.findByName("Bell rope tail").enabled = false;
    this.#physics = new BellRopePhysics(app.systems.rigidbody.physicsWorld, this.#anchor, this.#scale, 0.19);
    // Application has no postupdate event. Render after hero presentation and
    // animation evaluation so the held grip samples the current glove pose.
    this.#update = app.on("prerender", this.#sync, this);
    this.#sync();
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get #anchor() {
    // Continue from the authored hitch wrapped around the clapper's neck.
    // The 0.19 m upper rope preserves the 0.65 m grasp.
    return this.#bowl.getWorldTransform().transformPoint(new this.#pc.Vec3(0.004, 0.84, 0.001));
  }

  /**
   * @param {(()=>import("playcanvas").Vec3|null)|null} hand
   */
  set hand(hand) {
    this.#hand = hand;
  }

  #sync() {
    const hand = this.#hand?.() ?? null;
    // Establish contact only when the reaching glove actually encloses the knot.
    // Once held, Ammo keeps the knot attached throughout the pull.
    if (hand && !this.#grasped) {
      this.#grasped = hand.distance(this.#knot.getPosition()) <= 0.055 * this.#scale;
    }
    const anchor = this.#anchor;
    this.#physics.updateAttachments(anchor, this.#grasped ? hand : null);
    const transforms = this.#physics.transforms;
    // Bullet permits small joint residuals, especially immediately after release.
    // Share visual endpoints between neighboring bodies so the string stays
    // continuous while its bend and swing still come entirely from Ammo.
    const points = [anchor];
    for (let index = 1; index < transforms.length; index++) {
      const end = this.#endpoint(transforms[index - 1], -1);
      const start = this.#endpoint(transforms[index], 1);
      points.push(end.add(start).mulScalar(0.5));
    }
    points.push(this.#endpoint(transforms.at(-1), -1));
    if (this.#grasped && hand) {
      points[8] = hand.clone();
    }
    for (let index = 0; index < transforms.length; index++) {
      const top = points[index];
      const bottom = points[index + 1];
      const direction = top.clone().sub(bottom);
      const length = direction.length();
      const segment = this.#segments[index];
      segment.setPosition(top.clone().add(bottom).mulScalar(0.5));
      segment.setRotation(new this.#pc.Quat().setFromDirections(this.#pc.Vec3.UP, direction.normalize()));
      segment.setLocalScale(this.#scale, length, this.#scale);
    }
    this.#knot.setPosition(points[8]);
    this.#knot.setRotation(this.#segments[7].getRotation());
    this.#knot.setLocalScale(this.#scale, this.#scale, this.#scale);
  }

  /**
   * @param {{position: import("playcanvas").Vec3, rotation: import("playcanvas").Quat, length: number}} transform
   * @param {number} direction
   * @returns {import("playcanvas").Vec3}
   */
  #endpoint({ position, rotation, length }, direction) {
    return position.clone().add(rotation.transformVector(new this.#pc.Vec3(0, direction * length / 2, 0)));
  }

  release() {
    this.#hand = null;
    this.#grasped = false;
    this.#physics.release();
  }

  destroy() {
    this.#update.off();
    this.#physics.destroy();
    this.#root.destroy();
  }
}

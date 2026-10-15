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
    this.#physics = new BellRopePhysics(app.systems.rigidbody.physicsWorld, this.#anchor, this.#scale);
    // Application has no postupdate event. Render after hero presentation and
    // animation evaluation so the held grip samples the current glove pose.
    this.#update = app.on("prerender", this.#sync, this);
    this.#sync();
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get #anchor() {
    return this.#bowl.getWorldTransform().transformPoint(new this.#pc.Vec3(0, 0.9, 0));
  }

  /**
   * @param {(()=>import("playcanvas").Vec3|null)|null} hand
   */
  set hand(hand) { this.#hand = hand; }

  #sync() {
    this.#physics.updateAttachments(this.#anchor, this.#hand?.() ?? null);
    const transforms = this.#physics.transforms;
    for (let index = 0; index < transforms.length; index++) {
      const { position, rotation, length } = transforms[index];
      const segment = this.#segments[index];
      segment.setPosition(position);
      segment.setRotation(rotation);
      segment.setLocalScale(this.#scale, length, this.#scale);
    }
    const grip = transforms[7];
    const offset = grip.rotation.transformVector(new this.#pc.Vec3(0, -grip.length / 2, 0));
    this.#knot.setPosition(grip.position.clone().add(offset));
    this.#knot.setRotation(grip.rotation);
    this.#knot.setLocalScale(this.#scale, this.#scale, this.#scale);
  }

  release() {
    this.#hand = null;
    this.#physics.release();
  }

  destroy() {
    this.#update.off();
    this.#physics.destroy();
    this.#root.destroy();
  }
}

/**
 * Transient ice projectile. Ammo owns flight and impact; the cube is an effect,
 * never a replacement for Frost Puff's authored character model.
 */
export class FrostPuffShot {
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #handle;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #contact;
  /**
   * @type {number}
   */
  #remaining = 2;
  /**
   * @type {boolean}
   */
  #destroyed = false;

  /**
   * @param {import("./FrostPuff.js").FrostPuff} owner
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  constructor(owner, target) {
    this.owner = owner;
    this.target = target;
    const pc = owner.pc;
    const start = owner.position.clone().add(new pc.Vec3(0, 0.45, 0));
    const destination = owner.targetPosition(target).clone().add(new pc.Vec3(0, 0.45, 0));
    const direction = destination.sub(start).normalize();
    start.add(direction.clone().mulScalar(0.8));
    this.entity = new pc.Entity("Frost Puff frost shot");
    this.entity.setPosition(start);
    const visual = new pc.Entity("Transient ice");
    visual.setLocalScale(0.15, 0.15, 0.15);
    visual.addComponent("render", { type: "box" });
    this.material = new pc.StandardMaterial();
    this.material.diffuse.set(0.1, 0.7, 1);
    this.material.emissive.set(0.03, 0.25, 0.4);
    this.material.update();
    visual.render.meshInstances[0].material = this.material;
    this.entity.addChild(visual);
    this.entity.addComponent("collision", {
      type: "sphere",
      radius: 0.1,
    });
    this.entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 0.05,
      restitution: 0,
      friction: 0,
      angularFactor: new pc.Vec3(0, 0, 0),
    });
    owner.app.root.addChild(this.entity);
    this.entity.rigidbody.linearVelocity = direction.mulScalar(6);
    this.#contact = this.entity.collision.on("collisionstart", this.#impact, this);
    this.#handle = owner.app.on("update", this.#update, this);
  }

  /**
   * @param {{other: import("playcanvas").Entity}} result
   */
  #impact(result) {
    if (this.#destroyed || result.other === this.owner.entity || result.other.isDescendantOf(this.owner.entity)) {
      return;
    }
    for (const actor of this.owner.actors) {
      const root = actor.entity;
      if (root && (root === result.other || result.other.isDescendantOf(root))) {
        if (actor !== this.target || !this.owner.suppressesRivalContact(actor)) {
          this.owner.combat.chill(actor);
        }
        break;
      }
    }
    this.destroy();
  }

  /**
   * @param {number} dt
   */
  #update(dt) {
    this.#remaining -= dt;
    if (!this.owner.alive || this.#remaining <= 0 || this.owner.suppressesRivalContact(this.target)) {
      this.destroy();

      return;
    }
    // Cancel world gravity using a force, retaining Ammo collision response.
    const body = this.entity.rigidbody;
    const gravity = this.owner.app.systems.rigidbody.gravity;
    body.applyForce(-gravity.x * body.mass, -gravity.y * body.mass, -gravity.z * body.mass);
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#contact?.off();
    this.#handle?.off();
    this.entity.destroy();
    this.material.destroy();
    this.owner.shots.delete(this);
  }
}

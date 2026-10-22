/**
 * Transient spell cube, propelled and collided by Ammo. Its damage survives
 * suspension in a time bubble; local clocks never delete the projectile.
 */
export class RiftcapCubeBolt {
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #contactHandle = null;

  /**
   * @param {import("./Riftcap.js").Riftcap} owner
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  constructor(owner, target) {
    this.owner = owner;
    this.isProjectile = true;
    this.damage = 18;
    this.remaining = 4;
    const pc = owner.pc;
    const from = owner.position.clone().add(new pc.Vec3(0, 0.7, 0));
    const to = owner.targetPosition(target).clone().add(new pc.Vec3(0, 0.5, 0));
    const direction = to.sub(from).normalize();
    this.entity = new pc.Entity("Riftcap Cube Bolt");
    this.entity.setPosition(from.add(direction.clone().mulScalar(owner.radius + 0.15)));
    const visual = new pc.Entity("Transient spell cube");
    visual.setLocalScale(0.16, 0.16, 0.16);
    visual.addComponent("render", { type: "box" });
    this.material = new pc.StandardMaterial();
    this.material.diffuse.set(0.6, 0.05, 0.95);
    this.material.emissive.set(0.35, 0.01, 0.65);
    this.material.update();
    visual.render.meshInstances[0].material = this.material;
    this.entity.addChild(visual);
    owner.app.root.addChild(this.entity);
    this.entity.addComponent("collision", {
      type: "sphere",
      radius: 0.1,
    });
    this.entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 0.05,
      friction: 0,
      restitution: 0,
      angularFactor: new pc.Vec3(0, 0, 0),
    });
    this.entity.rigidbody.linearVelocity = direction.mulScalar(7);
    this.#contactHandle = this.entity.collision.on("collisionstart", this.#impact, this);
    this.#updateHandle = owner.app.on("update", /**
     *
     * @param {number} dt
     */
      (dt) => this.update(dt));
  }

  /**
   * @returns {boolean}
   */
  get alive() {
    return !this.#destroyed;
  }

  /**
   * @param {{other: import("playcanvas").Entity}} result
   */
  #impact(result) {
    const other = result.other;
    if (this.#destroyed || other === this.owner.entity || other.isDescendantOf(this.owner.entity)) {
      return;
    }
    for (const actor of this.owner.combatActors) {
      if (other === actor.entity || other.isDescendantOf(actor.entity)) {
        this.deliverDamage(actor);
        break;
      }
    }
    this.destroy();
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   */
  deliverDamage(actor) {
    if (actor.alive === false || actor === this.owner || actor.isEnemy) {
      return 0;
    }
    if (typeof actor.receiveDamage === "function") {
      return actor.receiveDamage(this.damage, this.owner, "arcane");
    }
    actor.beginGameOver?.(() => this.owner.position);

    return 0;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#destroyed) {
      return;
    }
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.destroy();

      return;
    }
    const body = this.entity.rigidbody;
    const gravity = this.owner.app.systems.rigidbody.gravity;
    body.applyForce(-gravity.x * body.mass, -gravity.y * body.mass, -gravity.z * body.mass);
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#updateHandle?.off();
    this.#contactHandle?.off();
    this.entity.destroy();
    this.material.destroy();
    this.owner.shots.delete(this);
  }
}

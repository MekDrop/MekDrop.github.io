/**
 * Short-lived world-space hazard owned and cleaned up by its creating imp.
 */
export class CinderHotPatch {
  /**
   * @type {Set<import("../shared/Enemy.js").EnemyActor>}
   */
  #contacts = new Set();
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #trigger = null;
  /**
   * @param {import("./CinderImp.js").CinderImp} owner
   * @param {import("playcanvas").Vec3} position
   */
  constructor(owner, position) {
    this.owner = owner;
    this.position = position.clone();
    this.remaining = 3;
    this.expired = false;
    if (owner.app.systems?.collision) {
      this.#trigger = new owner.pc.Entity("Cinder ground heat contact");
      this.#trigger.setPosition(position.x, position.y + 0.12, position.z);
      this.#trigger.addComponent("collision", {
        type: "box",
        halfExtents: new owner.pc.Vec3(0.6, 0.18, 0.6),
      });
      (owner.runtime.root ?? owner.app.root).addChild(this.#trigger);
      this.#trigger.collision.on("triggerenter", this.onContactEnter, this);
      this.#trigger.collision.on("triggerleave", this.onContactLeave, this);
    }
    this.effect = owner.runtime.createObject?.({
      id: `${owner.definition.id}-heat-${owner.elapsed}`,
      object: "Fire",
      position: this.position,
      volume: {
        x: 0.7,
        y: 0.15,
        z: 0.7,
      },
    }) ?? null;
    if (this.effect) {
      (owner.runtime.root ?? owner.app.root).addChild(this.effect.entity);
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.expired || !(dt > 0)) {
      return;
    }
    const activeTime = Math.min(dt, this.remaining);
    this.remaining -= dt;
    for (const actor of this.#contacts) {
      if (actor === this.owner || actor.alive === false || actor.isTower || actor.definition?.isTower) {
        continue;
      }
      if (this.owner.isFrostActor(actor)) {
        actor.applyStatus?.("steam", {
          duration: 0.4,
          source: this.owner,
        });
        this.owner.emitSteam(this.position, actor);
        this.destroy();

        return;
      }
      if (actor.element !== "fire") {
        actor.receiveDamage?.(8 * activeTime, this.owner, "fire");
      }
    }
    if (this.remaining <= 0) {
      this.destroy();
    }
  }

  /**
   * Ammo trigger event; held or airborne bodies do not receive synthetic proximity hits.
   * @param {import("playcanvas").Entity} entity
   */
  onContactEnter(entity) {
    let node = entity;
    while (node) {
      const actor = this.owner.actors.find(/**
       *
       * @param {import("../shared/Enemy.js").EnemyActor} candidate
       */
        (candidate) => candidate.entity === node);
      if (actor) {
        this.#contacts.add(actor);

        return;
      }
      node = node.parent;
    }
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  onContactLeave(entity) {
    for (const actor of this.#contacts) {
      let node = entity;
      while (node && node !== actor.entity) {
        node = node.parent;
      }
      if (node) {
        this.#contacts.delete(actor);
      }
    }
  }

  destroy() {
    if (this.expired) {
      return;
    }
    this.expired = true;
    this.#trigger?.destroy();
    this.#trigger = null;
    this.#contacts.clear();
    this.effect?.destroy();
    this.effect = null;
  }
}

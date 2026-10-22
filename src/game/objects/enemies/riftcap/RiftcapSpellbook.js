import { RiftcapCubeBolt } from "./RiftcapCubeBolt.js";
import { RiftcapStoneWard } from "./RiftcapStoneWard.js";
import { RiftcapTimeBubble } from "./RiftcapTimeBubble.js";
import { RiftcapSpellPresentation } from "./RiftcapSpellPresentation.js";

/**
 * Capability-based six-spell implementation. Physical queries fail closed.
 */
export class RiftcapSpellbook {
  /**
   * @type {RiftcapStoneWard[]}
   */
  #wards = [];
  /**
   * @type {{name:string,remaining:number,duration:number,visual:RiftcapSpellPresentation,follow:import("../shared/Enemy.js").EnemyActor|null}[]}
   */
  #pulses = [];

  /**
   * @param {import("./Riftcap.js").Riftcap} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.cooldowns = new Map();
    this.bubble = null;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} root
   */
  static belongsTo(entity, root) {
    return !!root && (entity === root || entity.isDescendantOf?.(root));
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   */
  isAlly(actor) {
    return !!actor && actor !== this.owner && actor.isEnemy === true && actor.alive !== false &&
      !!actor.entity && !actor.carrier && !actor.airborne;
  }

  /**
   * @param {number} radius
   */
  allies(radius = 4) {
    return this.owner.actors.filter(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => this.isAlly(actor) && this.owner.distanceTo(actor) <= radius);
  }

  /**
   * @param {string} spell
   */
  ready(spell) {
    return (this.cooldowns.get(spell) ?? 0) <= this.owner.elapsed;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  visible(target) {
    const owner = this.owner;
    const query = owner.app.systems?.rigidbody;
    const position = owner.targetPosition(target);
    if (!position || typeof query?.raycastAll !== "function") {
      return false;
    }
    const from = owner.position.clone().add(new owner.pc.Vec3(0, 0.6, 0));
    const to = position.clone().add(new owner.pc.Vec3(0, 0.6, 0));
    const hits = query.raycastAll(from, to).sort(/**
     *
     * @param {import("playcanvas").RaycastResult} a
     * @param {import("playcanvas").RaycastResult} b
     */
      (a, b) => a.hitFraction - b.hitFraction);
    for (const hit of hits) {
      if (RiftcapSpellbook.belongsTo(hit.entity, owner.entity)) {
        continue;
      }
      return RiftcapSpellbook.belongsTo(hit.entity, target.entity);
    }

    return true;
  }

  /**
   * Conservative capsule corridor sampling: three heights and nine offsets.
   * It rejects any solid obstruction, including a closed door, on either route.
   * This is a clearance query; Ammo still owns actual movement/contact.
   * @param {import("../shared/Enemy.js").EnemyActor} ally
   */
  canSwap(ally) {
    const owner = this.owner;
    const query = owner.app.systems?.rigidbody;
    if (!this.isAlly(ally) || owner.distanceTo(ally) > 4 || !ally.entity.rigidbody ||
      !owner.entity.rigidbody || typeof query?.raycastAll !== "function") {
      return false;
    }
    const a = owner.position;
    const b = ally.entity.getPosition();
    if (Math.abs(a.y - b.y) > (owner.carrier ? 1.8 : 0.4)) {
      return false;
    }
    // The creature replacing a held caster must inherit the carry capability.
    // Otherwise its active capsule would be teleported into the carrier.
    if (owner.carrier && !ally.canBeCarriedBy?.(owner.carrier)) {
      return false;
    }
    const radius = Math.max(owner.radius, ally.radius ?? 0.35);
    for (const actor of owner.combatActors) {
      if (actor === owner || actor === ally || !actor.entity || actor.alive === false || actor.isProjectile) {
        continue;
      }
      if (actor.isEnemy || actor.isCreature) {
        const position = actor.entity.getPosition();
        const clearance = radius + (actor.radius ?? 0.35);
        if (position.distance(a) < clearance || position.distance(b) < clearance) {
          return false;
        }
      }
    }
    for (const height of [0.15, 0.5, Math.max(owner.height, ally.height ?? 1) - 0.1]) {
      for (let sample = 0; sample < 9; sample++) {
        const angle = sample * Math.PI / 4;
        const offset = new owner.pc.Vec3(sample === 8 ? 0 : Math.cos(angle) * radius,
          height, sample === 8 ? 0 : Math.sin(angle) * radius);
        const hits = query.raycastAll(a.clone().add(offset), b.clone().add(offset));
        for (const hit of hits) {
          if (!RiftcapSpellbook.belongsTo(hit.entity, owner.entity) &&
            !RiftcapSpellbook.belongsTo(hit.entity, ally.entity) &&
            !RiftcapSpellbook.belongsTo(hit.entity, owner.carrier?.entity)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} ally
   */
  swap(ally) {
    if (!this.canSwap(ally)) {
      return false;
    }
    const owner = this.owner;
    const from = owner.position.clone();
    const to = ally.entity.getPosition().clone();
    const carrier = owner.carrier;
    if (carrier && !ally.beginCarry(carrier)) {
      return false;
    }
    owner.carrier = null;
    owner.entity.rigidbody.enabled = true;
    owner.entity.rigidbody.teleport(to);
    if (carrier) {
      ally.entity.setPosition(from);
    } else {
      ally.entity.rigidbody.teleport(from);
    }
    owner.stop();
    ally.stop?.();
    carrier?.onCarryEscaped?.(owner);
    if (ally.willingToSwap !== true) {
      ally.applyStatus?.("annoyed", {
        duration: 3,
        source: owner,
      });
      ally.onUnwillingSwap?.(owner);
    }
    this.#pulse("swap", from, 0.7, 0.35);
    this.#pulse("swap", to, 0.7, 0.35);

    return true;
  }

  /**
   * @param {number} dt
   */
  heal(dt) {
    let healed = 0;
    for (const ally of this.allies()) {
      if (this.visible(ally)) {
        healed += ally.receiveHealing?.(14 * dt) ?? 0;
      }
    }

    return healed;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} ally
   */
  ward(ally) {
    if (!this.isAlly(ally) || this.owner.distanceTo(ally) > 4 || !this.visible(ally) ||
      typeof ally.receiveDamage !== "function") {
      return false;
    }
    const visual = this.owner.app.graphicsDevice ?
      new RiftcapSpellPresentation(this.owner, "stone ward", ally.entity.getPosition(), 1.2) : null;
    this.#wards.push(new RiftcapStoneWard(ally, 6, 40, visual));

    return true;
  }

  shatter() {
    let count = 0;
    const owner = this.owner;
    for (const actor of owner.combatActors) {
      const body = actor.entity?.rigidbody;
      if (actor === owner || actor.alive === false || actor.carrier || !body ||
        body.type !== "dynamic" || owner.distanceTo(actor) > 2.8 || !this.visible(actor)) {
        continue;
      }
      const direction = actor.entity.getPosition().clone().sub(owner.position);
      direction.y = 0;
      if (direction.length() < 0.01) {
        direction.set(1, 0, 0);
      }
      direction.normalize().mulScalar(3.5 * body.mass);
      direction.y = 1.2 * body.mass;
      body.applyImpulse(direction);
      actor.applyStatus?.("knockback", {
        duration: 0.45,
        source: owner,
      });
      count++;
    }

    if (count) {
      this.#pulse("shatter", owner.position.clone(), 2.8, 0.4);
    }

    return count;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  bolt(target) {
    if (!target || target.alive === false || target.isEnemy || this.owner.distanceTo(target) > 6 || !this.visible(target)) {
      return false;
    }
    const shot = new RiftcapCubeBolt(this.owner, target);
    this.owner.shots.add(shot);

    return true;
  }

  timeBubble() {
    this.collapseBubble();
    this.bubble = new RiftcapTimeBubble(this.owner);
    this.bubble.update(0);

    return true;
  }

  collapseBubble() {
    this.bubble?.destroy();
    this.bubble = null;
  }

  /**
   * @param {string} name
   * @param {import("../shared/Enemy.js").EnemyActor|null} target
   */
  cast(name, target) {
    let result = false;
    switch (name) {
      case "bolt": result = this.bolt(target); break;
      case "swap": result = this.swap(target); break;
      case "heal":
        this.#pulse("mending", this.owner.position.clone(), 4, 2.5, this.owner);
        result = true;
        break;
      case "ward": result = this.ward(target); break;
      case "shatter": result = this.shatter() > 0; break;
      case "time_bubble": result = this.timeBubble(); break;
    }
    this.cooldowns.set(name, this.owner.elapsed + (name === "bolt" ? 2 : 9));

    return result;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.bubble?.update(dt);
    for (const ward of this.#wards) {
      ward.update(dt);
    }
    this.#wards = this.#wards.filter(RiftcapSpellbook.#activeWard);
    for (const pulse of this.#pulses) {
      pulse.remaining -= dt;
      if (pulse.remaining > 0) {
        pulse.visual.update(pulse.follow?.entity?.getPosition(), 1 - pulse.remaining / pulse.duration);
      } else {
        pulse.visual.destroy();
      }
    }
    this.#pulses = this.#pulses.filter(RiftcapSpellbook.#activePulse);
  }

  /**
   * @param {string} name
   * @param {import("playcanvas").Vec3} center
   * @param {number} radius
   * @param {number} duration
   * @param {import("../shared/Enemy.js").EnemyActor|null} follow
   */
  #pulse(name, center, radius, duration, follow = null) {
    if (!this.owner.app.graphicsDevice) {
      return;
    }
    const visual = new RiftcapSpellPresentation(this.owner, name, center, radius);
    this.#pulses.push({
      name,
      duration,
      remaining:duration,
      visual,
      follow,
    });
  }

  endMendingPresentation() {
    for (const pulse of this.#pulses) {
      if (pulse.name === "mending") {
        pulse.visual.destroy();
        pulse.remaining = 0;
      }
    }
    this.#pulses = this.#pulses.filter(RiftcapSpellbook.#activePulse);
  }

  /**
   * @param {{remaining:number}} pulse
   */
  static #activePulse(pulse) {
    return pulse.remaining > 0;
  }

  /**
   * @param {RiftcapStoneWard} ward
   */
  static #activeWard(ward) {
    return !ward.expired;
  }

  destroy() {
    this.collapseBubble();
    for (const ward of this.#wards) {
      ward.destroy();
    }
    this.#wards = [];
    for (const pulse of this.#pulses) {
      pulse.visual.destroy();
    }
    this.#pulses = [];
  }
}

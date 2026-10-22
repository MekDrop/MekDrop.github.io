/**
 * Contact damage and Ammo occlusion stay with this enemy, including friendly fire.
 */
export class WreckerCombat {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.reachedRoyals = new WeakSet();
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} root
   * @returns {boolean}
   */
  belongsTo(entity, root) {
    for (let node = entity; node; node = node.parent) {
      if (node === root) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @param {number} range
   * @returns {boolean}
   */
  canReach(actor, range = 1.8) {
    const owner = this.owner;
    const point = owner.targetPosition(actor);
    if (!point || owner.distanceTo(actor) > range) {
      return false;
    }
    const physics = owner.app.systems?.rigidbody;
    if (!physics?.raycastAll) {
      return false;
    }
    const start = owner.position.clone().add(new owner.pc.Vec3(0, 0.8, 0));
    const end = point.clone().add(new owner.pc.Vec3(0, 0.8, 0));
    const targetRoot = actor.audienceActor?.entity ?? actor.entity;
    const blockers = physics.raycastAll(start, end).filter(/**
     *
     * @param {import("playcanvas").RaycastResult} hit
     */
      (hit) =>
        !this.belongsTo(hit.entity, owner.entity) && !this.belongsTo(hit.entity, targetRoot));

    return blockers.length === 0;
  }

  /**
   * @param {Set<import("../shared/Enemy.js").EnemyActor>} struck
   * @param {number} amount
   */
  strike(struck, amount) {
    const owner = this.owner;
    if (!owner.alive) {
      return;
    }
    const door = owner.batterDoor;
    if (owner.stateName === "WreckerBatterState" && door && this.canReach(door, 1.8)) {
      door.receiveDamage(16);
      // Leave a full grid cell of clearance for rubble and a turning capsule.
      const width = Math.max(owner.breachWidth, Math.ceil((owner.radius * 2 + 0.3) * 2) / 2);
      if (door.broken && door.clearWidth < width) {
        for (const actor of owner.actors) {
          if (actor.breachDoorway?.(door, width, owner.height)) {
            owner.navigation.invalidate();
            break;
          }
        }
      }
    }
    const recipients = new Set(owner.contactActors);
    const royal = owner.resolveRoyalTarget();
    // Royals have no dynamic body; an Ammo-tested reach uses the actual resident.
    if (royal && !this.reachedRoyals.has(royal) && this.canReach(royal)) {
      recipients.add(royal);
    }
    if (owner.stateName === "WreckerHeadbuttState" && this.canReach(owner.pickupAggressor, 1.6)) {
      recipients.add(owner.pickupAggressor);
    }
    for (const actor of recipients) {
      if (actor.alive === false || struck.has(actor) || owner.suppressesRivalContact(actor)) {
        continue;
      }
      struck.add(actor);
      if (typeof actor.receiveDamage === "function") {
        actor.receiveDamage(amount, owner, "physical");
      } else if (actor !== royal) {
        actor.applyStatus?.("stun", { duration: 0.6 });
      }
      if (actor === royal && !this.reachedRoyals.has(royal)) {
        const performance = royal.beginGameOver?.(() => owner.position.clone());
        if (performance !== null && performance !== false) {
          this.reachedRoyals.add(royal);
          royal.startGameOverPerformance?.();
        }
      }
    }
  }
}

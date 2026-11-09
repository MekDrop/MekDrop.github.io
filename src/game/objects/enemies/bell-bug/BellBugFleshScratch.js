import { fleshSurface } from "./BellBugFleshSurface.js";
import { BellBugScratchBlood } from "./BellBugScratchBlood.js";
import { BellBugPursueState } from "./states/BellBugPursueState.js";

/**
 * Alternating front-claw strokes hurt on contact, never merely by proximity.
 */
export class BellBugFleshScratch {
  /**
   * @type {boolean}
   */
  #frozen = false;
  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.blood = new BellBugScratchBlood(owner);
    this.side = 0;
    this.reset();
  }

  reset() {
    if (this.#frozen && this.owner.animationPlayback) {
      this.owner.animationPlayback.speed = 1;
    }
    this.#frozen = false;
    this.target = null;
    this.stroke = null;
    this.time = 0;
    this.preparing = 0;
    this.hit = false;
    this.approachPosition = null;
    this.aim = null;
    this.facingAnchor = null;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  reachable(actor) {
    const b = this.owner;
    const living = actor === b.runtime.getHero?.() || actor.isRoyal || actor.audienceActor;
    if (!living || actor.isEnemy || typeof actor.receiveDamage !== "function" || actor.alive === false || actor.health <= 0
      || this.owner.distanceTo(actor) > b.radius + (actor.radius ?? 0.3) + 0.35) {
      return false;
    }
    const point = b.targetPosition(actor);
    if (!point || Math.abs(point.y - b.position.y) > 0.5) {
      return false;
    }
    const start = b.position.clone().add(new b.pc.Vec3(0, 0.3, 0));
    const end = point.clone().add(new b.pc.Vec3(0, 0.3, 0));
    const hits = b.app.systems?.rigidbody?.raycastAll(start, end) ?? [];

    if (!hits.some(this.#blocks.bind(this, actor))) {
      return true;
    }
    // A throne can hide the seated actor's root while an exposed lower leg
    // remains reachable. Query skin rather than treating the chair as flesh.
    const cached = actor === this.target ? this.stroke?.start ?? this.aim : null;
    if (cached) {
      const foot = b.animationPlayback?.scoopPose.foot(this.side);
      const origin = foot?.source ? foot.bone.getPosition() : start;
      const contacts = b.app.systems?.rigidbody?.raycastAll(origin, cached) ?? [];

      return !contacts.some(this.#blocks.bind(this, actor));
    }
    return !!fleshSurface(b, actor, this.side);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @param {import("playcanvas").RaycastResult} hit
   * @returns {boolean}
   */
  #blocks(actor, hit) {
    return hit.entity !== this.owner.entity && !hit.entity.isDescendantOf(this.owner.entity)
      && hit.entity !== actor.entity && !hit.entity.isDescendantOf(actor.entity);
  }

  /**
   * @param {number} dt
   * @param {boolean} active
   */
  update(dt, active) {
    const b = this.owner;
    if (b.modelLibrary && !b.animationPlayback) {
      this.reset();

      return;
    }
    if (!active || !b.alive || b.carrier || b.airborne || b.gatewayArrival.active
      || b.statuses.has("stun") || b.statuses.has("confused") || b.scoop.target
      || b.scoop.approachTarget || b.scoop.attentionTarget) {
      this.reset();

      return;
    }
    if (this.target && !this.reachable(this.target)) {
      this.reset();
    }
    if (this.target && this.facingAnchor && b.targetPosition(this.target).distance(this.facingAnchor) > 0.04) {
      this.reset();
    }
    this.target ??= b.actors.find(this.reachable.bind(this)) ?? null;
    if (!this.target) {
      return;
    }
    if (!this.facingAnchor) {
      b.faceTarget(this.aim ? { position: this.aim } : this.target);
    }
    if (!this.stroke) {
      if (this.approachPosition && Math.hypot(b.position.x - this.approachPosition.x, b.position.z - this.approachPosition.z) > 0.006) {
        return;
      }
      if (b.clip !== "scratch_attack") {
        b.playClip("scratch_attack");
        this.preparing = 0;
      }
      this.preparing += dt;
      if (this.preparing < 0.22) {
        return;
      }
      if (b.animationPlayback) {
        b.animationPlayback.speed = 0;
        this.#frozen = true;
      }
      this.#plan();
      if (!this.stroke) {
        return;
      }
    }
    if (b.targetPosition(this.target).distance(this.stroke.anchor) > 0.04) {
      this.reset();

      return;
    }
    b.stop();
    b.playClip("scratch_attack");
    const nextTime = this.time + dt;
    // Show the contact pose for at least one rendered frame after a hitch.
    this.time = !this.hit && this.time < 0.34 && nextTime >= 0.34 ? 0.34 : nextTime;
    if (!this.hit && this.time >= 0.34) {
      this.hit = true;
      const fresh = fleshSurface(b, this.target, this.side);
      if (!fresh || fresh.distance(this.stroke.start) > 0.06) {
        this.reset();

        return;
      }
      this.stroke.end.add(fresh.clone().sub(this.stroke.start));
      this.stroke.start.copy(fresh);
      const foot = b.animationPlayback?.scoopPose.foot(this.side);
      const origin = foot?.source ? foot.bone.getPosition() : b.position.clone().add(new b.pc.Vec3(0, 0.3, 0));
      const hits = b.app.systems?.rigidbody?.raycastAll(origin, this.stroke.start) ?? [];
      const blocked = hits.some(this.#blocks.bind(this, this.target));
      if (!blocked && (!foot || foot.canReach(this.stroke.start) && foot.canReach(this.stroke.end))) {
        const applied = this.target.receiveDamage(0.08, b, "scratch");
        if (applied > 0) {
          b.playFleshScratch?.(this.stroke.start);
          b.app.fire?.("bell-bug:scratch-contact", {
            bug: b,
            point: this.stroke.start.clone().lerp(this.stroke.start, this.stroke.end, Math.min(1, (this.time - 0.24) / 0.2)),
            direction: this.stroke.end.clone().sub(this.stroke.start).normalize(),
          });
        }
      }
    }
    if (this.time >= 0.8) {
      this.side = 1 - this.side;
      // Finish the stroke, not the encounter. Alternating claws must not
      // select a different body heading for the same stationary target.
      this.stroke = null;
      this.time = 0;
      this.hit = false;
      this.preparing = 0;
      this.approachPosition = null;
    }
  }

  #plan() {
    const b = this.owner;
    const aim = this.aim ?? fleshSurface(b, this.target, this.side);
    if (aim) {
      this.aim = aim;
      if (!this.facingAnchor) {
        b.faceTarget({ position: aim });
      }
    }
    this.approachPosition = null;
    this.preparing = 0;
    for (const side of [this.side, 1 - this.side]) {
      const start = fleshSurface(b, this.target, side);
      if (!start) {
        continue;
      }
      const end = start.clone().add(b.entity.right.clone().mulScalar(side ? -0.05 : 0.05))
        .sub(b.entity.forward.clone().mulScalar(0.025));
      end.y -= 0.015;
      const foot = b.animationPlayback?.scoopPose.foot(side);
      if (!foot || foot.canReach(start) && foot.canReach(end)) {
        this.side = side;
        this.facingAnchor ??= b.targetPosition(this.target).clone();
        this.stroke = {
          start,
          end,
          anchor: b.targetPosition(this.target).clone(),
        };

        return;
      }
      if (this.facingAnchor) {
        continue;
      }
      const direction = start.clone().sub(foot.bone.getPosition());
      direction.y = 0;
      direction.normalize();
      const available = start.clone().sub(b.position).length() - b.radius - 0.03;
      const needed = Math.max(foot.approachDistance(start, direction, 0.005) ?? Infinity,
        foot.approachDistance(end, direction, 0.005) ?? Infinity);
      if (needed !== null && needed > 0 && needed <= available) {
        const point = b.position.clone().add(direction.clone().mulScalar(needed));
        const bodyRadius = this.target.bodyRadius ?? (this.target.entity?.rigidbody ? this.target.radius ?? 0.3 : 0);
        const actorPosition = b.targetPosition(this.target);
        if (bodyRadius > 0 && Math.hypot(point.x - actorPosition.x, point.z - actorPosition.z) < b.radius + bodyRadius + 0.03) {
          continue;
        }
        if (!b.stepSupport || b.stepSupport.surface(point.x, point.z, point.y + 0.32, point.y - 0.35)) {
          this.approachPosition = point;
          this.aim = start;

          return;
        }
      }
    }
  }

  approach() {
    const b = this.owner;
    const moving = this.approachPosition && b.moveToward({ position: this.approachPosition }, 0.3, 0.002);
    if (!moving) {
      b.stop();
      if (!this.facingAnchor) {
        b.faceTarget(this.aim ? { position: this.aim } : this.target);
      }
    }
    b.playClip(moving ? "scuttle_walk" : "scratch_attack");
  }

  pose() {
    const b = this.owner, stroke = this.stroke;
    if (!stroke || !b.alive || b.carrier || b.airborne || b.stateName !== BellBugPursueState.name) {
      return;
    }
    const foot = b.animationPlayback.scoopPose.foot(this.side);
    if (!foot.source) {
      return;
    }
    const home = foot.point, goal = home.clone(), t = this.time % 0.8;
    if (t < 0.24) {
      goal.lerp(home, stroke.start, t / 0.24);
    } else if (t < 0.44) {
      goal.lerp(stroke.start, stroke.end, (t - 0.24) / 0.2);
    } else {
      goal.lerp(stroke.end, home, Math.min(1, (t - 0.44) / 0.26));
    }
    foot.pose(goal);
  }

  destroy() {
    this.reset();
    this.blood.destroy();
  }
}

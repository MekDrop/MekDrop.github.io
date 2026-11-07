import { LatchGlue } from "../latch-slug/LatchGlue.js";
import { BellBugGooMeal } from "./BellBugGooMeal.js";
import { BellBugScratchState } from "./states/BellBugScratchState.js";

/**
 * @typedef {{point:import("playcanvas").Vec3,mass:LatchGlue}} DoorGooTarget
 * @typedef {(door:import("../../architecture/door/Door.js").Door,origin:import("playcanvas").Vec3,maxReach:number)=>DoorGooTarget|null} DoorGooQuery
 */

/**
 * Reach-selected goo strokes precede random wood strokes. Ammo validates the
 * leaf contact; the same surface points drive the claws and removed material.
 */
export class BellBugDoorScratch {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {{random?:()=>number,findGoo?:DoorGooQuery}} options
   */
  constructor(owner, options = {}) {
    this.owner = owner;
    this.random = options.random ?? Math.random;
    this.findGoo = options.findGoo ?? LatchGlue.scrapeTarget;
    this.stroke = null;
    this.repositionTarget = null;
    this.failedStance = null;
    this.blockedStances = [];
    this.cycle = -1;
    this.gooStrokes = 0;
    this.woodStrokes = 0;
    this.removedVolume = 0;
    this.swallowedVolume = 0;
  }

  attach() {
    this.handle = this.owner.app.on("prerender", this.#pose, this);
  }

  reset() {
    this.meal?.destroy();
    this.meal = null;
    this.stroke = null;
    this.repositionTarget = null;
    this.failedStance = null;
    this.blockedStances = [];
    this.cycle = -1;
  }

  /**
   * @param {number} side
   * @returns {{foot:import("./BellBugScoopFoot.js").BellBugScoopFoot|null,pivot:import("playcanvas").Vec3,reach:number,side:number}}
   */
  #arm(side) {
    const b = this.owner;
    const foot = b.animationPlayback?.scoopPose.foot(side);
    if (foot?.source) {
      return {
        foot,
        pivot: foot.bone.getPosition().clone(),
        reach: foot.length * 1.55,
        side,
      };
    }
    const pivot = b.position.clone().add(b.entity.right.clone().mulScalar(side ? -0.15 : 0.15));
    pivot.y += 0.45;

    return {
      foot: null,
      pivot,
      reach: 0.5,
      side,
    };
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {boolean} goo
   * @param {import("playcanvas").Vec3|null} origin
   * @returns {boolean}
   */
  #clearContact(point, goo = false, origin = null) {
    const b = this.owner, door = b.scratchTarget;
    const start = origin?.clone() ?? b.position.clone();
    if (!origin) {
      start.y = point.y;
    }
    const end = goo ? point.clone() : point.clone().add(point.clone().sub(start).normalize().mulScalar(0.4));
    const contact = door.getHit?.(start, end);
    if (!contact && !goo) {
      return false;
    }
    const hits = b.app.systems?.rigidbody?.raycastAll(start, end) ?? [];
    for (const hit of hits) {
      if (hit.entity === b.entity || hit.entity.isDescendantOf(b.entity) || hit.hitFraction > (goo ? 1 - 0.025 / Math.max(0.01, start.distance(end)) : contact.distance + 0.01)) {
        continue;
      }
      if (goo || (!door.isLeafCollider?.(hit.entity) && hit.entity !== door.entity && !hit.entity.isDescendantOf(door.entity))) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {import("playcanvas").Vec3} origin
   * @returns {import("playcanvas").Vec3|null}
   */
  #project(point, origin) {
    const b = this.owner, door = b.scratchTarget;
    const outward = b.position.clone().sub(door.entity.getPosition());
    outward.y = 0;
    outward.normalize();
    const start = point.clone().add(outward.clone().mulScalar(0.7));
    const end = point.clone().sub(outward.clone().mulScalar(0.4));
    const hit = door.getHit?.(start, end);

    const surface = hit ? start.lerp(start, end, hit.distance) : null;

    return surface && door.getScratchPoint ? door.getScratchPoint(surface, origin, b) : surface;
  }

  /**
   * @param {number} side
   * @param {boolean} reserve
   * @returns {{point:import("playcanvas").Vec3,mass:LatchGlue,side:number}|null}
   */
  #goo(side, reserve = true) {
    if (this.failedStance) {
      if (this.owner.position.distance(this.failedStance)<0.16) {
        return null;
      }
      this.failedStance = null;
    }
    const arm = this.#arm(side);
    const target = this.findGoo?.(this.owner.scratchTarget, arm.pivot, arm.reach * (reserve ? 0.8 : 1));

    return target ? {
      ...target,
      side,
    } : null;
  }

  prepare() {
    const b = this.owner;
    if (!b.scratchTarget || b.phaseTime < 0.45 || this.repositionTarget) {
      return;
    }
    const cycle = Math.floor((b.phaseTime - 0.3) / 0.75);
    if (cycle === this.cycle) {
      return;
    }
    this.cycle = cycle;
    this.stroke = null;
    this.repositionTarget = null;
    const left = this.#goo(0) ?? this.#goo(0, false), right = this.#goo(1) ?? this.#goo(1, false);
    const goo = left && right ? Math.abs(left.point.y - right.point.y) < 0.015 ? cycle % 2 ? right : left : left.point.y < right.point.y ? left : right : left ?? right;
    if (goo) {
      const arm = this.#arm(goo.side);
      let end = goo.point.clone();
      // Braces can interrupt a vertical swipe. Shorten it on the same exposed
      // gel rather than forcing the claw through the projecting timber.
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = goo.point.clone().add(new b.pc.Vec3(0, -0.16 / 2 ** attempt, 0));
        if (candidate.distance(arm.pivot) <= arm.reach && this.#clearContact(candidate, true, arm.pivot)) {
          end = candidate;
          break;
        }
      }
      this.stroke = {
        door: b.scratchTarget,
        start: goo.point,
        end,
        mass: goo.mass,
        side: goo.side,
      };

      return;
    }
    if (this.#goo(0, false) || this.#goo(1, false)) {
      return;
    }
    this.repositionTarget = this.#findCollectingStance();
    if (this.repositionTarget) {
      return;
    }
    const side = cycle % 2, arm = this.#arm(side), door = b.scratchTarget;
    for (let attempt = 0; attempt < 12; attempt++) {
      const aim = door.entity.getPosition().clone();
      const lateral = b.position.clone().sub(aim).dot(door.entity.right) + (this.random() - 0.5) * 0.6;
      aim.add(door.entity.right.clone().mulScalar(lateral));
      aim.y = b.position.y + 0.25 + this.random() * 0.45;
      const start = this.#project(aim, arm.pivot);
      if (!start || start.distance(arm.pivot) > arm.reach || !this.#clearContact(start, false, arm.pivot)) {
        continue;
      }
      const end = this.#project(start.clone().add(door.entity.right.clone().mulScalar((this.random() - 0.5) * 0.13)).add(new b.pc.Vec3(0, -0.18, 0)), arm.pivot);
      if (!end || end.distance(arm.pivot) > arm.reach) {
        continue;
      }
      this.stroke = {
        door,
        start,
        end,
        mass: null,
        side,
      };

      return;
    }
  }

  /**
   * Probe actual claw reach from nearby standing positions along the leaf.
   * Walking remains native rigid-body movement; this only chooses a goal.
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  #findCollectingStance() {
    const b = this.owner, door = b.scratchTarget;
    const right = door.entity.right;
    const width = door.clearWidth ?? 1.2;
    const current = b.position.clone().sub(door.entity.getPosition()).dot(right);
    for (let step=1;step<=Math.ceil(width/0.12);step++) {
      for (const sign of [-1,1]) {
        const offset = step*0.12*sign;
        if (Math.abs(current+offset)>width/2-0.06) {
          continue;
        }
        const shift = right.clone().mulScalar(offset);
        const position = b.position.clone().add(shift);
        if (this.blockedStances.some(BellBugDoorScratch.#nearStance.bind(null,position))) {
          continue;
        }
        if (this.failedStance && b.position.clone().add(shift).distance(this.failedStance)<0.2) {
          continue;
        }
        for (const side of [0,1]) {
          const arm = this.#arm(side);
          const origin = arm.pivot.clone().add(shift);
          const target = this.findGoo?.(door,origin,arm.reach*0.98);
          if (target) {
            return {
              position,
              contact:target.point.clone(),
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Finish a committed sidestep before selecting another contact.
   * @param {boolean} blocked
   */
  finishReposition(blocked = false) {
    if (blocked && this.repositionTarget) {
      this.#rememberBlocked(this.repositionTarget.position);
    }
    this.repositionTarget = null;
    this.stroke = null;
    this.cycle = -1;
  }

  /**
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Vec3} other
   * @returns {boolean}
   */
  static #nearStance(position,other) {
    return Math.hypot(position.x-other.x,position.z-other.z)<0.16;
  }

  /**
   * @param {import("playcanvas").Vec3} position
   */
  #rememberBlocked(position) {
    this.blockedStances.push(position.clone());
    if (this.blockedStances.length>16) {
      this.blockedStances.shift();
    }
  }

  /**
   * A geometric candidate can still fail at real claw contact. Remember that
   * stance so the next cycle cannot silently select the same failed swipe.
   */
  #failedCollection() {
    if (!this.stroke?.mass) {
      this.stroke = null;

      return;
    }
    this.failedStance = this.owner.position.clone();
    this.#rememberBlocked(this.failedStance);
    this.stroke = null;
    this.repositionTarget = this.#findCollectingStance();
    this.cycle = -1;
  }

  /**
   * Walking turns the body sideways. Reach alone must not permit a scoop
   * through the flank while the bug is still returning to its working pose.
   * @returns {boolean}
   */
  get facingStroke() {
    if (!this.stroke) {
      return false;
    }
    const direction = this.facingTarget.position.clone().sub(this.owner.position);
    direction.y = 0;
    const forward = this.owner.entity.forward.clone();
    forward.y = 0;

    return direction.length()>0.001 && forward.normalize().dot(direction.normalize())>=Math.cos(35*Math.PI/180);
  }

  /**
   * Face straight into the leaf from this stance. Turning toward each toe's
   * lateral target swings the opposite socket away and starts another retry.
   * @returns {{position:import("playcanvas").Vec3}}
   */
  get facingTarget() {
    const b = this.owner, door = b.scratchTarget;
    const direction = door.entity.forward.clone();
    direction.y = 0;
    if (direction.dot(door.entity.getPosition().clone().sub(b.position))<0) {
      direction.mulScalar(-1);
    }

    return { position:b.position.clone().add(direction.normalize()) };
  }

  /**
   * Contact feedback belongs to the start of the drag, independently of whether
   * the end of that drag later removes enough material to register damage.
   * @returns {boolean}
   */
  beginContact() {
    const b = this.owner, stroke = this.stroke;
    if (!stroke || stroke.contactStarted || !this.facingStroke || this.repositionTarget || this.meal?.active) {
      return false;
    }
    const arm = this.#arm(stroke.side);
    const clear = stroke.door === b.scratchTarget && b.canScratchDoor && !b.carrier && !b.airborne &&
      stroke.start.distance(arm.pivot) <= arm.reach && this.#clearContact(stroke.start, Boolean(stroke.mass), arm.pivot);
    const wood = !stroke.mass && (stroke.door.getScratchPoint ? stroke.door.getScratchPoint(stroke.start, arm.pivot, b) : stroke.start);
    const freshGoo = !stroke.mass && (this.#goo(0, false) || this.#goo(1, false));
    if (!clear || freshGoo || (!stroke.mass && !wood) || stroke.mass?.active === false) {
      this.#failedCollection();

      return false;
    }
    if (stroke.mass) {
      b.playGooSound?.("gooPress", 1.08 + stroke.side * 0.04);
    } else {
      stroke.door.audio?.play("scratch");
    }
    stroke.contactStarted = true;

    return true;
  }

  /**
   * @returns {boolean}
   */
  apply() {
    const b = this.owner, stroke = this.stroke;
    if (!stroke || stroke.door !== b.scratchTarget || !b.canScratchDoor || !this.facingStroke || this.repositionTarget || this.meal?.active) {
      return false;
    }
    const arm = this.#arm(stroke.side);
    if (!this.#clearContact(stroke.start, Boolean(stroke.mass), arm.pivot) || !this.#clearContact(stroke.end, Boolean(stroke.mass), arm.pivot)) {
      this.#failedCollection();

      return false;
    }
    if (stroke.start.distance(arm.pivot) > arm.reach || stroke.end.distance(arm.pivot) > arm.reach) {
      this.#failedCollection();

      return false;
    }
    arm.foot?.pose(stroke.end);
    if (stroke.mass) {
      const removed = stroke.mass.scrapeAt(stroke.start, stroke.end, 0.085, /**
       *
       * @param {{positions:number[],material:import("playcanvas").StandardMaterial,volume:number}} sample
       */
        sample => {
          this.meal?.destroy();
          this.meal = new BellBugGooMeal(b, sample, stroke.side, stroke.end);
        });
      this.removedVolume += removed;
      this.gooStrokes += removed > 0 ? 1 : 0;
      if (removed<=0) {
        this.#failedCollection();
      } else {
        this.failedStance = null;
        this.blockedStances = [];
      }

      return removed > 0;
    }
    // Goo may have flowed into reach since this stroke's windup.
    if (this.#goo(0, false) || this.#goo(1, false)) {
      return false;
    }
    const width = arm.foot ? Math.max(0.025, Math.min(0.085, arm.foot.length * 0.3)) : 0.045;
    const damage = stroke.door.scratchSurface?.(stroke.start, stroke.end, b, width, !stroke.contactStarted) ?? 0;
    this.woodStrokes += damage > 0 ? 1 : 0;

    return damage > 0;
  }

  /**
   * @param {number} side
   */
  #park(side) {
    const b = this.owner, arm = this.#arm(side);
    if (!arm.foot) {
      return;
    }
    const goal = arm.pivot.clone()
      .add(b.entity.right.clone().mulScalar(side ? -0.035 : 0.035))
      .add(b.entity.forward.clone().mulScalar(0.06));
    goal.y += 0.035;
    arm.foot.pose(goal);
  }

  #pose() {
    const b = this.owner, stroke = this.stroke;
    if (this.repositionTarget) {
      return;
    }
    if (b.stateName === BellBugScratchState.name && b.alive && !b.carrier && !b.airborne) {
      const active = this.meal?.active ? this.meal.side : stroke?.side;
      for (const side of [0, 1]) {
        if (side !== active) {
          this.#park(side);
        }
      }
    }
    if (this.meal?.active) {
      const arm = this.#arm(this.meal.side);
      this.meal.pose();
      if (arm.foot?.canReach(this.meal.goal)) {
        arm.foot.pose(this.meal.goal);
      }

      return;
    }
    if (!stroke || b.stateName !== BellBugScratchState.name || !b.alive || b.carrier || b.airborne) {
      return;
    }
    const arm = this.#arm(stroke.side);
    if (!arm.foot || !arm.foot.canReach(stroke.start) || !arm.foot.canReach(stroke.end)) {
      return;
    }
    const local = (b.phaseTime - 0.3) % 0.75;
    const home = arm.foot.point;
    const goal = home.clone();
    if (local < 0.2) {
      goal.lerp(home, stroke.start, Math.max(0, local / 0.2));
    } else if (local < 0.55) {
      goal.lerp(stroke.start, stroke.end, (local - 0.2) / 0.35);
    } else {
      goal.lerp(stroke.end, home, Math.min(1, (local - 0.55) / 0.2));
    }
    arm.foot.pose(goal);
  }

  destroy() {
    this.handle?.off();
    this.reset();
  }
}

import { LatchBridgeContact } from "./LatchBridgeContact.js";

/**
 * A failed living contributor returns through actual ground and bank-wall
 * contacts. Native adhesive constraints own the slow climb and lip roll.
 */
export class LatchBankReturn {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3} target
   */
  constructor(owner, target) {
    this.owner = owner;
    this.target = target.clone();
    this.phase = "walk";
    this.grip = null;
    this.normal = null;
    this.origin = null;
    this.originalPivot = null;
    this.age = 0;
    this.stalledAge = 0;
    this.lastPosition = owner.position.clone();
    this.detour = null;
    this.detourAttempts = 0;
    this.blocked = false;
    this.walkProgressAge = 0;
    this.walkClosestDistance = Infinity;
    this.unsupportedAge = 0;
    this.resumeTarget = null;
  }

  /**
   * @param {import("playcanvas").ContactResult} result
   */
  contact(result) {
    const owner = this.owner;
    if (this.grip?.point && result.other?.rigidbody?.type === "static" && result.other !== this.grip.other &&
      (this.phase === "roll" || this.phase === "top")) {
      for (const contact of result.contacts ?? []) {
        const point = contact.pointOther ?? contact.point;
        if (point && Math.abs(contact.normal?.y ?? 0) >= 0.8 &&
          Math.abs(point.y - owner.position.y) < 0.15 && Math.abs(point.y - this.target.y) < 0.15) {
          this.grip.destroy();
          this.grip = new LatchBridgeContact(owner, result.other, point, true);
          this.origin = point.clone();
          this.originalPivot = this.grip.extension.clone();
          this.phase = "top";

          return;
        }
      }
    }
    if (this.grip || result.other?.rigidbody?.type !== "static" || this.phase !== "walk") {
      return;
    }
    for (const contact of result.contacts ?? []) {
      const point = contact.pointOther ?? contact.point;
      if (!point || Math.abs(contact.normal?.y ?? 1) > 0.3 ||
        Math.hypot(point.x - this.target.x, point.z - this.target.z) > 1.2 ||
        point.y > this.target.y + 0.1 || this.target.y - point.y > 3) {
        continue;
      }
      const normal = contact.normal.clone();
      const outward = owner.position.clone().add(new owner.pc.Vec3(0, owner.height / 2, 0)).sub(point);
      if (normal.dot(outward) < 0) {
        normal.mulScalar(-1);
      }
      if (this.target.clone().sub(owner.position).dot(normal) >= 0) {
        continue;
      }
      if (!this.#climbClear(point, normal, result.other)) {
        this.#avoidBlockedWall(normal);

        return;
      }
      this.grip = new LatchBridgeContact(owner, result.other, point, true);
      if (this.grip.point) {
        this.normal = normal;
        this.origin = point.clone();
        this.originalPivot = this.grip.extension.clone();
        this.phase = "wall";
        this.age = 0;
        this.stalledAge = 0;
        owner.airborne = false;
        owner.grounded = false;
      }

      return;
    }
  }

  /**
   * @param {number} deltaTime
   * @returns {"working"|"complete"|"failed"}
   */
  update(deltaTime) {
    const owner = this.owner;
    this.age += deltaTime;
    this.stalledAge += deltaTime;
    if (owner.position.distance(this.lastPosition) > 0.05) {
      this.lastPosition.copy(owner.position);
      this.stalledAge = 0;
    }
    const ground = this.#ground(owner.position);
    if (ground && Math.hypot(owner.position.x - this.target.x, owner.position.z - this.target.z) < 0.4 &&
      Math.abs(ground.point.y - this.target.y) < 0.15) {
      this.destroy();
      if (this.resumeTarget) {
        this.target.copy(this.resumeTarget);
        this.resumeTarget = null;
        this.phase = "walk";
        this.age = 0;
        this.walkProgressAge = 0;
        this.walkClosestDistance = Infinity;
        owner.airborne = false;
        owner.grounded = true;

        return "working";
      }

      return "complete";
    }
    if (this.phase === "walk") {
      this.unsupportedAge = ground ? 0 : this.unsupportedAge + deltaTime;
      const goal = this.detour ?? this.target;
      const remaining = Math.hypot(owner.position.x - goal.x, owner.position.z - goal.z);
      this.walkProgressAge += deltaTime;
      if (remaining < this.walkClosestDistance - 0.08) {
        this.walkClosestDistance = remaining;
        this.walkProgressAge = 0;
      }
      if (this.age > 120 || this.walkProgressAge > 12 || this.unsupportedAge > 12 || this.blocked) {
        owner.stop();

        return "failed";
      }
      if (owner.airborne || !ground) {
        return "working";
      }
      if (this.detour && Math.hypot(owner.position.x - this.detour.x, owner.position.z - this.detour.z) < 0.15) {
        this.detour = null;
        this.walkClosestDistance = Infinity;
        this.walkProgressAge = 0;
      }
      const delta = (this.detour ?? this.target).clone().sub(owner.position);
      delta.y = 0;
      if (delta.length() < 0.001) {
        return "failed";
      }
      delta.normalize();
      const next = owner.position.clone().add(delta.clone().mulScalar(0.2));
      if (!this.#ground(next)) {
        owner.stop();

        return "working";
      }
      const body = owner.entity.rigidbody;
      body.linearVelocity = new owner.pc.Vec3(delta.x * 0.65, body.linearVelocity.y, delta.z * 0.65);
      owner.faceTarget({ position: this.detour ?? this.target });

      return "working";
    }
    if (!this.grip?.point) {
      this.destroy();
      owner.airborne = true;
      owner.grounded = false;

      return "failed";
    }
    if (this.stalledAge > 8 || this.age > 60) {
      this.phase = "retreat";
    }
    if (this.phase !== "retreat" && !this.#climbClear(this.grip.point, this.normal, this.grip.other)) {
      this.phase = "retreat";
    }
    if (this.phase === "retreat") {
      this.grip.roll(this.originalPivot, deltaTime);
      const next = this.grip.point.clone();
      next.y = Math.max(this.origin.y, next.y - 0.1);
      const hit = this.#wall(next);
      if (hit) {
        this.grip.crawl(hit.point, deltaTime);
      }
      if (ground) {
        this.destroy();

        return "failed";
      }

      return "working";
    }
    const point = this.grip.point;
    if (this.phase === "wall") {
      const next = point.clone();
      next.y = Math.min(this.target.y, next.y + 0.04);
      const hit = this.#wall(next);
      if (hit && point.y < this.target.y - 0.02) {
        this.grip.crawl(hit.point, deltaTime);
      } else {
        const inside = point.clone().sub(this.normal.clone().mulScalar(0.12));
        const top = this.#top(inside, false);
        if (top && Math.abs(top.point.y - this.target.y) < 0.15 && point.y >= top.point.y - 0.12) {
          if (top.entity === this.grip.other) {
            const lip = point.clone();
            lip.y = top.point.y;
            this.grip.crawl(lip, deltaTime);
          }
          if (Math.abs(this.grip.point.y - top.point.y) < (top.entity === this.grip.other ? 0.02 : 0.12)) {
            this.phase = "roll";
          }
        }
      }
    } else if (this.phase === "roll") {
      this.grip.roll(new owner.pc.Vec3(), deltaTime);
      if (this.grip.extension.length() < 0.015) {
        this.phase = "top";
      }
    } else if (this.phase === "top") {
      this.grip.roll(new owner.pc.Vec3(), deltaTime);
      const delta = this.target.clone().sub(point);
      delta.y = 0;
      if (delta.length() > 0.001) {
        const next = point.clone().add(delta.normalize().mulScalar(0.1));
        const top = this.#top(next);
        if (top && Math.abs(top.point.y - this.target.y) < 0.15) {
          this.grip.crawl(top.point, deltaTime);
        }
      }
    }

    return "working";
  }

  /**
   * Verify the whole capsule's ascent before a wall joint can lift it into
   * overhead living material. Dynamic bridge bodies are real obstacles here.
   * @param {import("playcanvas").Vec3} point
   * @param {import("playcanvas").Vec3} normal
   * @param {import("playcanvas").Entity} wall
   * @returns {boolean}
   */
  #climbClear(point, normal, wall) {
    const owner = this.owner;
    const center = point.clone().add(normal.clone().mulScalar(owner.radius + 0.03));
    const tangent = new owner.pc.Vec3(normal.z, 0, -normal.x);
    for (const [side, depth] of [[0, 0], [-0.9, 0], [0.9, 0], [0, -0.9], [0, 0.9], [-0.63, -0.63], [-0.63, 0.63], [0.63, -0.63], [0.63, 0.63]]) {
      const from = center.clone().add(tangent.clone().mulScalar(owner.radius * side))
        .add(normal.clone().mulScalar(owner.radius * depth));
      const to = from.clone();
      from.y = Math.max(owner.position.y + 0.05, point.y - owner.height / 2);
      to.y = this.target.y + owner.height + 0.08;
      if (owner.app.systems.rigidbody.raycastFirst(from, to, {
        filterCallback: /**
                         * @param {import("playcanvas").Entity} entity
                         */
          (entity) => entity !== owner.entity && entity !== wall,
      })) {
        return false;
      }
    }

    return true;
  }

  /**
   * Walk sideways on actual floor before approaching a clear adjacent lip.
   * @param {import("playcanvas").Vec3} normal
   */
  #avoidBlockedWall(normal) {
    const owner = this.owner;
    if (this.detour) {
      return;
    }
    if (this.detourAttempts >= 2) {
      this.blocked = true;
      owner.stop();

      return;
    }
    const tangent = new owner.pc.Vec3(normal.z, 0, -normal.x);
    for (const side of [2, -2, 1.5, -1.5]) {
      const target = this.target.clone().add(tangent.clone().mulScalar(side));
      const from = target.clone();
      const to = target.clone();
      from.y += 0.15;
      to.y -= 0.15;
      const top = owner.app.systems.rigidbody.raycastFirst(from, to, { filterCallback: LatchBankReturn.#static });
      const detour = owner.position.clone().add(tangent.clone().mulScalar(side));
      if (top?.normal.y < 0.9 || !top) {
        continue;
      }
      // The actual trench has raised side strips. Reach their real lower lip
      // through the same native wall grip before approaching the upper bank.
      const low = detour.clone();
      const high = detour.clone();
      high.y += 0.65;
      low.y -= 0.15;
      const step = owner.app.systems.rigidbody.raycastFirst(high, low, { filterCallback: LatchBankReturn.#static });
      const rise = step?.point.y - owner.position.y;
      if (!this.resumeTarget && step?.normal.y >= 0.9 && rise > 0.15 && rise <= 0.6) {
        this.resumeTarget = target;
        this.target.copy(step.point);
        this.detourAttempts++;
        this.age = 0;
        this.walkClosestDistance = Infinity;
        this.walkProgressAge = 0;

        return;
      }
      if (Math.abs(rise) <= 0.13 && this.#ground(detour)) {
        this.target.copy(target);
        this.detour = detour;
        this.detourAttempts++;
        this.age = 0;
        this.walkClosestDistance = Infinity;
        this.walkProgressAge = 0;

        return;
      }
    }
    this.blocked = true;
    owner.stop();
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {import("playcanvas").RaycastResult|null}
   */
  #wall(point) {
    const from = point.clone().add(this.normal.clone().mulScalar(0.15));
    const to = point.clone().sub(this.normal.clone().mulScalar(0.15));

    return this.owner.app.systems.rigidbody.raycastFirst(from, to, { filterCallback: this.#sameWall.bind(this) });
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  #sameWall(entity) {
    return entity === this.grip.other;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {boolean} [requireOwned]
   * @returns {import("playcanvas").RaycastResult|null}
   */
  #top(point, requireOwned = true) {
    const from = point.clone();
    const to = point.clone();
    from.y = this.target.y + 0.3;
    to.y = this.target.y - 0.2;
    const hit = this.owner.app.systems.rigidbody.raycastFirst(from, to, { filterCallback: LatchBankReturn.#static });

    if (!hit || hit.normal.y < 0.8 || (requireOwned && hit.entity !== this.grip.other)) {
      return null;
    }
    const headFrom = hit.point.clone();
    const headTo = hit.point.clone();
    headFrom.y += 0.05;
    headTo.y += this.owner.height + 0.05;
    const ceiling = this.owner.app.systems.rigidbody.raycastFirst(headFrom, headTo, { filterCallback: LatchBankReturn.#static });

    return ceiling ? null : hit;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {import("playcanvas").RaycastResult|null}
   */
  #ground(point) {
    const from = point.clone();
    const to = point.clone();
    from.y += 0.13;
    to.y -= 0.16;
    const hit = this.owner.app.systems.rigidbody.raycastFirst(from, to, { filterCallback: LatchBankReturn.#static });

    return hit?.normal.y >= 0.8 && Math.abs(hit.point.y - this.owner.position.y) < 0.13 ? hit : null;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #static(entity) {
    return entity.rigidbody?.type === "static";
  }

  destroy() {
    this.grip?.destroy();
    this.grip = null;
  }
}

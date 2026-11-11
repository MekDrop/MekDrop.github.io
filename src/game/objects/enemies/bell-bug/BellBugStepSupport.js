/**
 * Ammo capsule step offset, restricted to grounded walking and low solid treads.
 */
export class BellBugStepSupport {
  /**
   * @type {import("./BellBug.js").BellBug}
   */
  owner;
  /**
   * @type {number|null}
   */
  pendingHeight;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  pendingPoint = null;
  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.pendingHeight = null;
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} top
   * @param {number} bottom
   * @returns {import("playcanvas").RaycastResult|undefined}
   */
  surface(x, z, top, bottom) {
    const b = this.owner;
    const hits = b.app.systems?.rigidbody?.raycastAll(
      new b.pc.Vec3(x, top, z), new b.pc.Vec3(x, bottom, z),
      { sort: true },
    ) ?? [];

    return hits.find(/**
     *
     * @param {import("playcanvas").RaycastResult} hit
     */
      hit => hit.normal?.y > 0.8 &&
      hit.entity !== b.entity && !hit.entity.isDescendantOf(b.entity) &&
      hit.entity.rigidbody?.type === "static");
  }

  /**
   * @param {import("playcanvas").Vec3} direction
   */
  advance(direction) {
    const b = this.owner, body = b.entity.rigidbody, p = b.position;
    const length = Math.hypot(direction.x, direction.z);
    if (!length || !body || (!b.grounded && this.pendingHeight === null) || b.airborne || b.carrier ||
      b.statuses.has("stun") || Math.abs(body.linearVelocity.y) > 1.5) {
      this.pendingHeight = null;
      this.pendingPoint = null;

      return;
    }
    const dx = direction.x / length, dz = direction.z / length;
    // The capsule can touch an axis-aligned riser while travelling diagonally.
    // Reach past that face along the dominant axis, not merely along heading.
    const reach = (b.radius + 0.04) / Math.max(Math.abs(dx), Math.abs(dz));
    let ahead = this.surface(p.x + dx * reach, p.z + dz * reach, p.y + 0.32, p.y - 0.12);
    const below = this.surface(p.x, p.z, p.y + 0.06, p.y - 0.13);
    const continuing = this.pendingPoint && (!below || Math.abs(below.point.y + 0.004 - this.pendingHeight) > 0.04);
    if (continuing) {
      if ((this.pendingPoint.x - p.x) * dx + (this.pendingPoint.z - p.z) * dz < -0.02 ||
        Math.hypot(this.pendingPoint.x - p.x, this.pendingPoint.z - p.z) > b.radius + 0.16) {
        this.pendingHeight = null;
        this.pendingPoint = null;

        return;
      }
      // Finish the same measured riser before looking for another course.
      ahead = this.surface(this.pendingPoint.x, this.pendingPoint.z, this.pendingHeight + 0.04, this.pendingHeight - 0.08);
    } else {
      this.pendingHeight = null;
      this.pendingPoint = null;
    }
    if (!ahead || (!below && this.pendingHeight === null)) {
      this.pendingHeight = null;
      this.pendingPoint = null;

      return;
    }
    // Use the capsule's resting contact clearance. A larger visual clearance
    // could turn a reachable 0.30 m riser into a rejected >0.32 m lift after
    // the capsule settled a few millimeters below the authored stair base.
    const target = Math.min(ahead.point.y + 0.004, p.y + 0.32);
    const rise = target - p.y;
    if ((!continuing && rise <= 0.008) || rise > 0.32 ||
      (!below && Math.abs(target - this.pendingHeight) > 0.04)) {
      if (below) {
        this.pendingHeight = null;
      }
      return;
    }
    // Ammo's dynamic capsule has no step offset. A bounded native velocity and
    // gravity compensation climb the riser continuously; repeated teleports
    // otherwise lift a trailing bug off its support and let it fall back.
    // Check the raised capsule's center and shoulders against walls/ceilings.
    for (const offset of [-b.radius * 0.8, 0, b.radius * 0.8]) {
      const x = p.x - dz * offset, z = p.z + dx * offset;
      const start = new b.pc.Vec3(x, target + b.radius, z);
      const end = new b.pc.Vec3(x + dx * reach, target + b.radius, z + dz * reach);
      const blocked = b.app.systems.rigidbody.raycastAll(start, end).some(/**
       *
       * @param {import("playcanvas").RaycastResult} hit
       */
        hit =>
          hit.entity !== b.entity && !hit.entity.isDescendantOf(b.entity));
      const ceiling = b.app.systems.rigidbody.raycastAll(
        new b.pc.Vec3(x, p.y + b.height - 0.02, z),
        new b.pc.Vec3(x, target + b.height, z),
      ).some(/**
       *
       * @param {import("playcanvas").RaycastResult} hit
       */
        hit => hit.entity !== b.entity && !hit.entity.isDescendantOf(b.entity));
      if (blocked || ceiling) {
        return;
      }
    }
    const velocity = body.linearVelocity;
    body.applyForce?.(0, body.mass * Math.abs(b.app.systems.rigidbody.gravity?.y ?? -9.81), 0);
    body.linearVelocity = new b.pc.Vec3(velocity.x, Math.max(-0.2, Math.min(0.8, rise * 8)), velocity.z);
    this.pendingHeight = target;
    this.pendingPoint = ahead.point.clone();
  }
}

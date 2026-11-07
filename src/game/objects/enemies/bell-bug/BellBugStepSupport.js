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
    if (!length || !body || !b.grounded || b.airborne || b.carrier ||
      b.statuses.has("stun") || Math.abs(body.linearVelocity.y) > 1.5) {
      this.pendingHeight = null;

      return;
    }
    const dx = direction.x / length, dz = direction.z / length;
    const reach = b.radius + 0.04;
    const ahead = this.surface(p.x + dx * reach, p.z + dz * reach, p.y + 0.32, p.y - 0.12);
    const below = this.surface(p.x, p.z, p.y + 0.06, p.y - 0.13);
    if (!ahead || (!below && this.pendingHeight === null)) {
      this.pendingHeight = null;

      return;
    }
    // Use the capsule's resting contact clearance. A larger visual clearance
    // could turn a reachable 0.30 m riser into a rejected >0.32 m lift after
    // the capsule settled a few millimeters below the authored stair base.
    const target = Math.min(ahead.point.y + 0.004, p.y + 0.32);
    const rise = target - p.y;
    if (rise <= 0.008 || rise > 0.32 ||
      (!below && Math.abs(target - this.pendingHeight) > 0.04)) {
      if (below) {
        this.pendingHeight = null;
      }
      return;
    }
    // Ammo's dynamic capsule has no step offset. Like the hero, lift only a
    // normal stair course; Ammo still owns travel, gravity, falls and contacts.
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
    const velocity = body.linearVelocity.clone();
    body.teleport(new b.pc.Vec3(p.x, target, p.z), b.entity.getEulerAngles());
    velocity.y = Math.max(0, velocity.y);
    body.linearVelocity = velocity;
    this.pendingHeight = target;
  }
}

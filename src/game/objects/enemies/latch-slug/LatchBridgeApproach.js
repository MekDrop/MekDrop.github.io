/**
 * Contact-supported local traversal of live bridge tissue. Only Ammo advances
 * the body. Missing or steep support stops the worker before the edge.
 */
export class LatchBridgeApproach {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3} destination
   * @returns {boolean} Whether a local supported approach owns this frame.
   */
  static advance(owner, destination) {
    if (owner.airborne) {
      return true;
    }
    const physics = owner.app?.systems?.rigidbody;
    const body = owner.entity.rigidbody;
    if (!body || !physics?.raycastFirst) {
      return false;
    }
    const delta = destination.clone().sub(owner.position);
    const distance = Math.hypot(delta.x, delta.z);
    if (distance < 0.12) {
      owner.stop();

      return true;
    }
    delta.y = 0;
    delta.mulScalar(1 / distance);
    const step = Math.min(0.3, distance);
    const point = owner.position.clone().add(delta.clone().mulScalar(step));
    const support = LatchBridgeApproach.#support(owner, point);
    const current = LatchBridgeApproach.#support(owner, owner.position);
    if (!owner.grounded || !current || Math.abs(current.point.y - owner.position.y) > 0.25) {
      owner.stop();

      return true;
    }
    if (!support || Math.abs(support.point.y - owner.position.y) > 0.16) {
      owner.stop();

      return true;
    }
    body.linearVelocity = new owner.pc.Vec3(delta.x * 0.9, body.linearVelocity.y, delta.z * 0.9);
    owner.faceTarget({ position: destination });

    return true;
  }

  /**
   * Bank workers may yield onto actual supported grass beside the road. This
   * validates the full short motor segment rather than the social path policy.
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3} destination
   * @param {import("./LatchSlug.js").LatchSlug} requester
   * @returns {boolean}
   */
  static clearPeerStep(owner, destination, requester) {
    const physics = owner.app?.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return false;
    }
    const origin = owner.position;
    const actors = owner.runtime.objects?.getWithMethod?.("clearPeerStep") ?? owner.actors ?? [];
    const steps = Math.max(1, Math.ceil(origin.distance(destination) / 0.12));
    const radius = owner.radius * 0.8;
    for (let index = 1; index <= steps; index++) {
      const point = origin.clone().lerp(origin, destination, index / steps);
      for (const [x, z] of [[0, 0], [-radius, 0], [radius, 0], [0, -radius], [0, radius]]) {
        const from = point.clone().add(new owner.pc.Vec3(x, 0.2, z));
        const to = point.clone().add(new owner.pc.Vec3(x, -0.22, z));
        const hit = physics.raycastFirst(from, to, { filterCallback: LatchBridgeApproach.#staticSupport });
        if (!hit || !(hit.normal?.y >= 0.8) || Math.abs(hit.point.y - origin.y) > 0.12) {
          return false;
        }
      }
      for (const actor of actors) {
        const position = actor.position ?? actor.entity?.getPosition?.();
        if (actor === owner || actor === requester || actor.alive === false || actor.carrier || actor.airborne ||
          actor.isBridgeCommitted || actor.entity?.rigidbody?.enabled === false || !position || Math.abs(position.y - origin.y) > 0.6) {
          continue;
        }
        const clearance = owner.radius + (actor.radius ?? 0.42) + 0.08;
        const distance = Math.hypot(point.x - position.x, point.z - position.z);
        if (distance < clearance && distance <= Math.hypot(origin.x - position.x, origin.z - position.z) + 0.00001) {
          return false;
        }
      }
      const from = origin.clone().add(new owner.pc.Vec3(0, owner.height / 2, 0));
      const to = point.clone().add(new owner.pc.Vec3(0, owner.height / 2, 0));
      const obstacle = physics.raycastFirst(from, to, { filterCallback: LatchBridgeApproach.#staticSupport });
      if (obstacle && Math.abs(obstacle.normal?.y ?? 0) < 0.8) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #staticSupport(entity) {
    return entity.rigidbody?.type === "static";
  }

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3} point
   * @returns {import("playcanvas").RaycastResult|null}
   */
  static #support(owner, point) {
    const start = point.clone();
    const end = point.clone();
    start.y = owner.position.y + 0.7;
    end.y = owner.position.y - 0.8;

    return owner.app.systems.rigidbody.raycastFirst(start, end, {
      filterCallback: LatchBridgeApproach.#isSupport,
    });
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #isSupport(entity) {
    return entity.rigidbody?.type === "static" || entity.tags?.has("hero-moving-support");
  }
}

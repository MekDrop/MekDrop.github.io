import { BellBugCalibration } from "./BellBugCalibration.js";

/**
 * Leave foot room instead of driving Ammo capsules up other enemies.
 */
export class BellBugCrowdMotion {
  /**
   * @type {number}
   */
  #blockedAge = 0;
  /**
   * @type {number}
   */
  #passingSide = 0;
  /**
   * @type {import("./BellBug.js").BellBug}
   */
  owner;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * AI controls only horizontal intent. Gravity and contacts remain with Ammo.
   * @returns {boolean}
   */
  constrain() {
    const b = this.owner, body = b.entity.rigidbody;
    const velocity = body.linearVelocity;
    const speed = Math.hypot(velocity.x, velocity.z);
    if (!speed) {
      return false;
    }
    const forwardX = velocity.x / speed, forwardZ = velocity.z / speed;
    let allowed = speed;
    let blocker = null;
    const neighbours = [];
    const hero = b.runtime?.getHero?.();
    for (const actor of b.actors) {
      const isHero = actor === hero;
      if (actor === b || (!actor.isEnemy && !isHero) || (!isHero && !actor.alive) || actor.carrier || actor.airborne ||
        !actor.entity?.rigidbody || actor.entity.rigidbody.enabled === false) {
        continue;
      }
      const p = b.targetPosition(actor);
      if (!p || p.y >= b.position.y + b.height || p.y + (actor.height ?? 0.8) <= b.position.y) {
        continue;
      }
      const dx = p.x - b.position.x, dz = p.z - b.position.z;
      const radius = actor.isBellBug ? BellBugCalibration.spacingRadius :
        isHero && b.fleshScratch?.target === actor ? actor.bodyRadius ?? actor.radius ?? 0.3 : actor.radius ?? 0.3;
      // A raised scooping claw can enter its own foot margin. Keep both native
      // capsules separated, and retain normal clearance from every other peer.
      const ownRadius = isHero || actor === b.scoop?.approachTarget ? b.radius : BellBugCalibration.spacingRadius;
      const clearance = ownRadius + radius + 0.03;
      neighbours.push({
        position: p,
        clearance,
      });
      const ahead = dx * forwardX + dz * forwardZ;
      if (ahead <= 0) {
        continue;
      }
      const side = Math.abs(dx * forwardZ - dz * forwardX);
      if (side >= clearance) {
        continue;
      }
      // Distance to the next actor's circular footprint along this lane.
      const gap = ahead - Math.sqrt(clearance * clearance - side * side);
      const limit = Math.max(0, gap / 0.2);
      if (limit < allowed) {
        allowed = limit;
        blocker = actor;
      }
    }
    const peerVelocity = blocker?.entity.rigidbody.linearVelocity;
    const following = peerVelocity && peerVelocity.x * forwardX + peerVelocity.z * forwardZ > 0.15;
    if (allowed < speed * 0.8 && !following) {
      this.#blockedAge += b.deltaTime ?? 1 / 60;
      // Local passing must stay within the authored path, including when
      // close route waypoints bypass the shared lane planner.
      if (this.#blockedAge >= 0.45) {
        const passing = this.#passingVelocity(forwardX, forwardZ, speed, neighbours);
        if (passing) {
          body.linearVelocity = passing;

          return true;
        }
      }
    } else {
      this.#blockedAge = 0;
      this.#passingSide = 0;
    }
    body.linearVelocity = new b.pc.Vec3(forwardX * allowed, velocity.y, forwardZ * allowed);

    return allowed > 0.01;
  }

  /**
   * Check the path corridor at the actor's floor.
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  #onPath(x = this.owner.position.x, z = this.owner.position.z) {
    const b = this.owner, map = b.runtime?.mapData, position = b.position;
    for (const path of map?.paths ?? []) {
      for (let index = 1; index < path.route.length; index++) {
        const first = path.route[index - 1], second = path.route[index];
        const dx = second.col - first.col, dz = second.row - first.row;
        const lengthSq = dx * dx + dz * dz;
        if (!lengthSq) {
          continue;
        }
        const startX = first.col - (map.cols - 1) / 2, startZ = first.row - (map.rows - 1) / 2;
        const fraction = Math.max(0, Math.min(1,
          ((x - startX) * dx + (z - startZ) * dz) / lengthSq));
        const elevation = first.elevation + (second.elevation - first.elevation) * fraction;
        if (Math.abs(position.y - elevation) < 0.6 &&
          Math.hypot(x - startX - dx * fraction, z - startZ - dz * fraction) <= 1 - BellBugCalibration.spacingRadius) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * A stopped actor must not become a permanent roadblock. Commit to one
   * passing side, checking both creature footprints and real Ammo clearance.
   * @param {number} forwardX
   * @param {number} forwardZ
   * @param {number} speed
   * @param {Array<{position:import("playcanvas").Vec3,clearance:number}>} neighbours
   * @returns {import("playcanvas").Vec3|null}
   */
  #passingVelocity(forwardX, forwardZ, speed, neighbours) {
    const b = this.owner;
    const sides = this.#passingSide ? [this.#passingSide, -this.#passingSide] : [1, -1];
    for (const side of sides) {
      for (const degrees of this.#onPath() ? [30, 60, 90] : [30, 60, 90, 120]) {
        const angle = side * degrees * Math.PI / 180;
        const dx = forwardX * Math.cos(angle) - forwardZ * Math.sin(angle);
        const dz = forwardX * Math.sin(angle) + forwardZ * Math.cos(angle);
        if (this.#clearPassingDirection(dx, dz, neighbours)) {
          this.#passingSide = side;

          return new b.pc.Vec3(dx * speed * 0.7, b.entity.rigidbody.linearVelocity.y, dz * speed * 0.7);
        }
      }
    }

    return null;
  }

  /**
   * @param {number} dx
   * @param {number} dz
   * @param {Array<{position:import("playcanvas").Vec3,clearance:number}>} neighbours
   * @returns {boolean}
   */
  #clearPassingDirection(dx, dz, neighbours) {
    const b = this.owner, origin = b.position;
    const onPath = this.#onPath();
    for (const distance of [0.35, 0.7]) {
      const x = origin.x + dx * distance, z = origin.z + dz * distance;
      if (onPath && !this.#onPath(x, z)) {
        return false;
      }
      for (const neighbour of neighbours) {
        // Existing contact must allow movement away from a peer. Rejecting
        // every overlapping starting footprint locks a whole cluster in place.
        const separating = (origin.x - neighbour.position.x) * dx + (origin.z - neighbour.position.z) * dz >= -0.0001;
        if (separating && Math.hypot(origin.x - neighbour.position.x, origin.z - neighbour.position.z) < neighbour.clearance) {
          continue;
        }
        if (Math.hypot(x - neighbour.position.x, z - neighbour.position.z) < neighbour.clearance) {
          return false;
        }
      }
      if (b.stepSupport && !b.stepSupport.surface(x, z, origin.y + 0.32, origin.y - 0.35)) {
        return false;
      }
    }
    const physics = b.app?.systems?.rigidbody;
    if (physics?.raycastAll) {
      for (const side of [-b.radius, 0, b.radius]) {
        const start = new b.pc.Vec3(origin.x - dz * side, origin.y + 0.36, origin.z + dx * side);
        const end = start.clone().add(new b.pc.Vec3(dx * 0.7, 0, dz * 0.7));
        const hits = physics.raycastAll(start, end);
        for (const hit of hits) {
          if (hit.entity !== b.entity && !hit.entity.isDescendantOf?.(b.entity) &&
            hit.entity.rigidbody?.type === "static" && Math.abs(hit.normal?.y ?? 0) < 0.8) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

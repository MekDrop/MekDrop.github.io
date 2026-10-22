import { CastleResidentMotion } from "../../castle/residents/CastleResidentMotion.js";
import { CrownCrabObstacleProbe } from "./CrownCrabObstacleProbe.js";

/**
 * Reuses the production castle floor/stair planner as a look-ahead cursor.
 * Its setPosition writes ONLY a detached planning entity. The crab's real root
 * is moved exclusively by Enemy.moveToward and Ammo, never by this planner.
 */
export class CrownCrabNavigation {
  /**
   * @type {import("./CrownCrab.js").CrownCrab}
   */
  #owner;
  /**
   * @type {import("playcanvas").Entity}
   */
  #cursor;
  /**
   * @type {CastleResidentMotion|null}
   */
  #motion = null;
  /**
   * @type {import("../../castle/Castle.js").Castle|null}
   */
  #castle = null;
  /**
   * @type {CrownCrabObstacleProbe}
   */
  #probe;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #royalPoint = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #approachPoint = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #pending = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #lastPosition = null;
  /**
   * @type {number}
   */
  #pendingDistance = Infinity;
  /**
   * @type {number}
   */
  #pendingStall = 0;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #escapePoint = null;
  /**
   * @type {number}
   */
  #escapeTime = 0;

  /**
   * @param {import("./CrownCrab.js").CrownCrab} owner
   */
  constructor(owner) {
    this.#owner = owner;
    this.#cursor = new owner.pc.Entity("Crown Crab route cursor (not rendered)");
    this.#probe = new CrownCrabObstacleProbe(owner);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  next(target) {
    if (!(target?.isRoyal || typeof target?.beginGameOver === "function")) {
      return null;
    }
    const owner = this.#owner;
    const destination = owner.targetPosition(target).clone();
    const castle = owner.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => {
        const layout = actor.residence?.layout;
        if (!layout) {
          return false;
        }
        const local = layout.toLocal(destination.x, destination.z);

        return layout.walkableAreas.some(/**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
       */
          (area) => local.x >= area.minX && local.x <= area.maxX &&
        local.z >= area.minZ && local.z <= area.maxZ && Math.abs(area.floorY - destination.y) < 0.6);
      });
    if (!castle) {
      return null;
    }
    if (castle !== this.#castle) {
      this.#attach(castle);
    }
    if (this.#lastPosition && this.#lastPosition.distance(owner.position) > 0.5) {
      this.#motion.stop();
      this.#pending = null;
      this.#escapePoint = null;
    }
    this.#lastPosition = owner.position.clone();
    const layout = castle.residence.layout;
    if (!this.#royalPoint || this.#royalPoint.distance(destination) > 0.2) {
      this.#royalPoint = destination.clone();
      const direction = owner.position.clone().sub(destination);
      direction.y = 0;
      this.#approachPoint = destination.clone().add(direction.normalize().mulScalar(0.95));
      const royalLocal = layout.toLocal(destination.x, destination.z);
      const floor = layout.walkableAreas.find(/**
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
       */ (area) => royalLocal.x >= area.minX && royalLocal.x <= area.maxX && royalLocal.z >= area.minZ && royalLocal.z <= area.maxZ && Math.abs(area.floorY - destination.y) < 0.6);
      this.#approachPoint.y = floor?.floorY ?? destination.y;
      let bestDistance = Infinity;
      const angle = Math.atan2(direction.z, direction.x);
      for (let index = 0; index < 16; index++) {
        const heading = angle + index * Math.PI / 8;
        for (const radius of [1, 1.1]) {
          const candidate = destination.clone().add(new owner.pc.Vec3(Math.cos(heading) * radius, 0, Math.sin(heading) * radius));
          candidate.y = this.#approachPoint.y;
          const distance = candidate.distance(owner.position);
          const localCandidate = layout.toLocal(candidate.x, candidate.z);
          const onFloor = layout.walkableAreas.some(/**
           *
           * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
           */
            (area) => Math.abs(area.floorY - candidate.y) < 0.3 && localCandidate.x >= area.minX && localCandidate.x <= area.maxX && localCandidate.z >= area.minZ && localCandidate.z <= area.maxZ);
          if (onFloor && distance < bestDistance && !castle.residence.blocksMovementAt(candidate.x, candidate.z, owner.radius, candidate.y) && !this.#probe.blockedAt(candidate) && this.#contactReachable(candidate, target)) {
            this.#approachPoint = candidate;
            bestDistance = distance;
          }
        }
      }
    }
    // A seated royal occupies its throne. Route to claw reach, not into the seat.
    destination.copy(this.#approachPoint);
    const local = layout.toLocal(owner.position.x, owner.position.z);
    const inside = layout.walkableAreas.some(/**
     *
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
     */
      (area) => local.x >= area.minX && local.x <= area.maxX &&
      local.z >= area.minZ && local.z <= area.maxZ && Math.abs(area.floorY - owner.position.y) < 0.5);
    {
      const doors = [...castle.entranceDoors];
      doors.sort(/**
       *
       * @param {import("../../architecture/door/Door.js").Door} a
       * @param {import("../../architecture/door/Door.js").Door} b
       */
        (a, b) => a.entity.getPosition().distance(owner.position) - b.entity.getPosition().distance(owner.position));
      if (doors.length) {
        const nearest = doors[0].entity.getPosition();
        const group = doors.filter(/**
         *
         * @param {import("../../architecture/door/Door.js").Door} door
         */
          (door) => door.entity.getPosition().distance(nearest) < 3);
        const entry = new owner.pc.Vec3();
        for (const door of group) {
          entry.add(door.entity.getPosition());
        }
        entry.mulScalar(1 / group.length);
        entry.y = owner.position.y;
        const inward = doors[0].entity.forward.clone().mulScalar(-1);
        const offset = owner.position.clone().sub(entry);
        const along = offset.dot(inward);
        const lateral = Math.abs(offset.x * inward.z - offset.z * inward.x);
        if (along > -3 && along < 1.1 && lateral < 3 && Math.abs(owner.position.y - nearest.y) < 0.6) {
          const advance = along < -0.4 && lateral > 0.15 ? -0.9 : 1.15;

          return { position: entry.add(inward.mulScalar(advance)) };
        }
        if (!inside && entry.distance(owner.position) > 0.75) {
          return { position: entry };
        }
      }
    }
    // A swinging leaf can push the physical body into the planner's clearance
    // margin. Escape along the real manifold normal before asking for a route.
    if (this.#escapePoint) {
      this.#escapeTime += owner.deltaTime;
      if (this.#escapeTime < 1 && Math.hypot(this.#escapePoint.x - owner.position.x, this.#escapePoint.z - owner.position.z) > 0.03) {
        return { position: this.#escapePoint };
      }
      this.#escapePoint = null;
    }
    if (this.#probe.blockedAt(owner.position) && this.#probe.escape?.lengthSq() > 0.001) {
      this.#pending = null;
      this.#motion.stop();
      this.#escapePoint = owner.position.clone().add(this.#probe.escape.clone().mulScalar(0.25));
      this.#escapeTime = 0;

      return { position: this.#escapePoint };
    }
    // Wait for the physical body to reach each proposed step before consuming
    // another route corner. Resetting only the cursor can skip an untraversed turn.
    const remaining = this.#pending ? Math.hypot(this.#pending.x - owner.position.x, this.#pending.z - owner.position.z) : 0;
    if (this.#pending && remaining > 0.015) {
      this.#pendingStall = remaining < this.#pendingDistance - 0.005 ? 0 : this.#pendingStall + owner.deltaTime;
      this.#pendingDistance = remaining;
      if (this.#pendingStall < 0.8 && !this.#probe.blockedAt(this.#pending)) {
        return { position: this.#pending };
      }
      // Door leaves move after a route is selected. Discard a step that became
      // obstructed or stopped advancing rather than insisting on the old turn.
      this.#motion.stop();
      this.#pending = null;
    }
    this.#cursor.setPosition(owner.position);
    this.#motion.moveTo(destination);
    this.#motion.update(0.05);
    const point = this.#cursor.getPosition().clone();

    this.#pending = point;
    this.#pendingDistance = point.distance(owner.position);
    this.#pendingStall = 0;

    return { position: point };
  }

  /**
   * A free standing point can still be behind the throne's solid back.
   * @param {import("playcanvas").Vec3} point
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  #contactReachable(point, target) {
    const system = this.#owner.app.systems.rigidbody;
    if (!system?.raycastAll) {
      return true;
    }
    const offset = new this.#owner.pc.Vec3(0, 0.45, 0);
    const start = point.clone().add(offset);
    const end = this.#owner.targetPosition(target).clone().add(new this.#owner.pc.Vec3(0, 0.9, 0));
    for (const hit of system.raycastAll(start, end, { sort: true })) {
      if (hit.entity === this.#owner.entity || hit.entity.isDescendantOf(this.#owner.entity)) {
        continue;
      }
      return hit.entity === target.entity || hit.entity.isDescendantOf(target.entity);
    }

    return true;
  }

  /**
   * @param {import("../../castle/Castle.js").Castle} castle
   */
  #attach(castle) {
    this.#motion?.stop();
    this.#castle = castle;
    this.#pending = null;
    this.#escapePoint = null;
    this.#royalPoint = null;
    this.#approachPoint = null;
    const layout = castle.residence.layout;
    const entryAreas = castle.entranceDoors.map(/**
     *
     * @param {import("../../architecture/door/Door.js").Door} door
     */
      (door) => {
        const p = layout.toLocal(door.entity.getPosition().x, door.entity.getPosition().z);

        return {
          minX:p.x-0.9,
          maxX:p.x+0.9,
          minZ:p.z-0.9,
          maxZ:p.z+0.9,
          floorY:layout.origin.y,
        };
      });
    const planningLayout = {
      origin: layout.origin,
      walkableAreas: [...layout.walkableAreas, ...entryAreas],
      authoredStairs: layout.authoredStairs,
      stairs: layout.stairs,
      toWorld: layout.toWorld.bind(layout),
      toLocal: layout.toLocal.bind(layout),
    };
    this.#motion = new CastleResidentMotion({
      actor: {
        entity:this.#cursor,
        pose:()=>{},
      },
      layout: planningLayout,
      /**
       * @param {import("playcanvas").Vec3} point
       * @param {boolean} avoidDoors
       * @param {boolean} includeProps
       */
      blocked: (point, avoidDoors, includeProps = true) => castle.residence.blocksMovementAt(point.x, point.z, this.#owner.radius, point.y) ||
        (includeProps && this.#probe.blockedAt(point)),
      // Closed leaves remain obstacles; the crab's claw state opens them.
      /**
       * @param {import("playcanvas").Vec3|null} point
       */
      clear: (point) => !point || !castle.entranceDoors.some(/**
       *
       * @param {import("../../architecture/door/Door.js").Door} door
       */
        (door) => door.blocksCameraAt(point.x, point.y + 0.4, point.z, this.#owner.radius)),
    });
  }

  destroy() {
    this.#motion?.stop();
    this.#probe.destroy();
    this.#cursor.destroy();
  }

  /**
   * @returns {{approach:import("playcanvas").Vec3|null,blocked:boolean,probe:{ready:boolean,ammo:boolean,queries:number,contacts:number}}}
   */
  get diagnostics() {
    return {
      approach: this.#approachPoint?.clone() ?? null,
      blocked: this.#approachPoint ? this.#probe.blockedAt(this.#approachPoint) : false,
      probe: this.#probe.diagnostics,
      currentBlocked: this.#probe.blockedAt(this.#owner.position),
    };
  }
}

import { CastleResidentMotion } from "../../castle/residents/CastleResidentMotion.js";
import { NpcObstacleProbe } from "../../shared/NpcObstacleProbe.js";

/**
 * Reuses the production castle floor/stair planner as a look-ahead cursor.
 * Its setPosition writes ONLY a detached planning entity. The gremlin's real root
 * is moved exclusively by Enemy.moveToward and Ammo, never by this planner.
 */
export class WireGremlinNavigation {
  /**
   * @type {import("./WireGremlin.js").WireGremlin}
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
   * @type {NpcObstacleProbe}
   */
  #probe;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #royalSeat = null;
  /**
   * @type {number}
   */
  #nextEvidence = 0;
  /**
   * @type {number}
   */
  #doorReach = 1.1;
  /**
   * @type {number}
   */
  #measureDoorAfter = 0;

  /**
   * @param {import("./WireGremlin.js").WireGremlin} owner
   */
  constructor(owner) {
    this.#owner = owner;
    this.#cursor = new owner.pc.Entity("Wire Gremlin route cursor (not rendered)");
    this.#probe = new NpcObstacleProbe(owner.app);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  next(target) {
    if (!(target?.isRoyal || typeof target?.beginGameOver === "function")) {
      return this.#avoid(this.#owner.targetPosition(target));
    }
    const owner = this.#owner;
    const destination = owner.targetPosition(target);
    if (target.entity && target.entity !== this.#royalSeat) {
      this.#probe.destroy();
      // The royal is seated inside its throne collider. Reuse the production
      // seat's narrow front access corridor so the route can reach attack range.
      this.#probe = new NpcObstacleProbe(owner.app, target.entity);
      this.#royalSeat = target.entity;
    }
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
      return this.#avoid(destination);
    }
    if (castle !== this.#castle) {
      this.#attach(castle);
    }
    const layout = castle.residence.layout;
    const local = layout.toLocal(owner.position.x, owner.position.z);
    // The planning floor includes authored clearance above the physical floor.
    // Resetting its cursor to the rigidbody's lower root each frame otherwise
    // spends the small look-ahead budget climbing that same clearance forever.
    const planningOrigin = owner.position.clone();
    const floors = layout.walkableAreas.filter(/**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
     */
      (area) => local.x >= area.minX && local.x <= area.maxX &&
      local.z >= area.minZ && local.z <= area.maxZ && Math.abs(area.floorY - owner.position.y) <= 0.32);
    floors.sort(/**
     * @param {{floorY:number}} a
     * @param {{floorY:number}} b
     */
      (a, b) => Math.abs(a.floorY - owner.position.y) - Math.abs(b.floorY - owner.position.y));
    if (floors.length) {
      planningOrigin.y = floors[0].floorY;
    }
    this.#cursor.setPosition(planningOrigin);
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
        if (destination.clone().sub(entry).dot(inward) < 0) {
          inward.mulScalar(-1);
        }
        const offset = owner.position.clone().sub(entry);
        const along = offset.dot(inward);
        const lateral = Math.abs(offset.x * inward.z - offset.z * inward.x);
        if (owner.elapsed >= this.#measureDoorAfter) {
          this.#measureDoorAfter = owner.elapsed + 1;
          this.#doorReach = 1.1;
          // Castle doors may render through a separate baked hierarchy. Ask
          // their public collision query rather than assuming child meshes.
          for (let forward = 0; forward <= 4; forward += 0.2) {
            for (let side = -3; side <= 3; side += 0.2) {
              const sample = entry.clone().add(inward.clone().mulScalar(forward));
              sample.x += inward.z * side;
              sample.z -= inward.x * side;
              const blocked = group.some(/**
               * @param {import("../../architecture/door/Door.js").Door} door
               */ (door) => door.blocksCameraAt(sample.x, sample.y + owner.height * 0.8, sample.z, owner.radius));
              if (blocked) {
                this.#doorReach = Math.max(this.#doorReach, forward + owner.radius + 0.15);
              }
            }
          }
        }
        const clearance = this.#doorReach;
        // Open leaves still have real Ammo collision. Clear their measured
        // inward reach along the doorway center before turning into the room.
        if (owner.definition.recordEvidence && owner.elapsed >= this.#nextEvidence) {
          this.#nextEvidence = owner.elapsed + 1;
          console.log(`Wire Gremlin route: ${JSON.stringify({
            elapsed: owner.elapsed,
            entry: entry.toArray(),
            inward: inward.toArray(),
            along,
            lateral,
            clearance,
            inside,
          })}`);
        }
        if (along > -3 && along < clearance && lateral < 3 && Math.abs(owner.position.y - nearest.y) < 0.6) {
          const advance = along < -0.4 && lateral > 0.15 ? -0.9 : clearance + 0.1;

          return this.#avoid(entry.add(inward.mulScalar(advance)));
        }
        if (!inside && entry.distance(owner.position) > 0.75) {
          return this.#avoid(entry);
        }
      }
    }
    this.#motion.moveTo(destination);
    this.#motion.update(owner.deltaTime);
    const point = this.#cursor.getPosition().clone();

    return this.#avoid(Math.hypot(point.x - owner.position.x, point.z - owner.position.z) > 0.001 ? point : destination);
  }

  /**
   * Probe short steering candidates against actual authored prop triangles.
   * Ammo still moves the root and resolves every physical contact.
   * @param {import("playcanvas").Vec3|null} destination
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  #avoid(destination) {
    if (!destination) {
      return null;
    }
    const origin = this.#owner.position;
    const dx = destination.x - origin.x;
    const dz = destination.z - origin.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) {
      this.#step(destination);

      return { position: destination };
    }
    const reach = Math.min(distance, 0.8);
    const yaw = Math.atan2(dx, dz);
    let best = null;
    let bestScore = Infinity;
    for (const angle of [0, -30, 30, -60, 60, -90, 90, -120, 120]) {
      const heading = yaw + angle * Math.PI / 180;
      const point = origin.clone().add(new this.#owner.pc.Vec3(Math.sin(heading) * reach, 0, Math.cos(heading) * reach));
      const middle = origin.clone().lerp(origin, point, 0.5);
      if (this.#probe.blockedAt(middle) || this.#probe.blockedAt(point)) {
        continue;
      }
      if (angle === 0) {
        this.#step(point);

        return { position: point };
      }
      const score = Math.hypot(destination.x - point.x, destination.z - point.z) + Math.abs(angle) * 0.002;
      if (score < bestScore) {
        best = point;
        bestScore = score;
      }
    }

    if (best) {
      this.#step(best);
    }

    return { position: best ?? origin.clone() };
  }

  /**
   * Ammo's dynamic capsule has no walking step offset. A bounded upward
   * velocity crosses a measured low tread; Ammo integrates the lift and contact.
   * @param {import("playcanvas").Vec3} destination
   */
  #step(destination) {
    const owner = this.#owner;
    const body = owner.entity.rigidbody;
    if (!body || owner.airborne || owner.carrier || body.linearVelocity.y > 0.1) {
      return;
    }
    const direction = destination.clone().sub(owner.position);
    direction.y = 0;
    if (direction.length() < 0.001) {
      return;
    }
    direction.normalize().mulScalar(owner.radius + 0.15);
    const ahead = owner.position.clone().add(direction);
    const options = {
      /**
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback: (entity) => entity.rigidbody?.type === "static",
    };
    const hit = owner.app.systems.rigidbody.raycastFirst(ahead.clone().add(new owner.pc.Vec3(0, 0.25, 0)), ahead.clone().add(new owner.pc.Vec3(0, -0.05, 0)), options);
    const rise = hit ? hit.point.y - owner.position.y : 0;
    if (!hit || hit.normal.y < 0.75 || rise < 0.035 || rise > 0.22) {
      return;
    }
    const upper = owner.position.clone().add(new owner.pc.Vec3(0, owner.height * 0.7, 0));
    if (owner.app.systems.rigidbody.raycastFirst(upper, upper.clone().add(direction), options)) {
      return;
    }
    const velocity = body.linearVelocity;
    const gravity = Math.abs(owner.app.systems.rigidbody.gravity.y);
    body.linearVelocity = new owner.pc.Vec3(velocity.x, Math.sqrt(2 * gravity * (rise + 0.04)), velocity.z);
  }

  /**
   * @param {import("../../castle/Castle.js").Castle} castle
   */
  #attach(castle) {
    this.#motion?.stop();
    this.#castle = castle;
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
      // Closed leaves remain obstacles. This gremlin enters doors opened by gameplay.
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
}

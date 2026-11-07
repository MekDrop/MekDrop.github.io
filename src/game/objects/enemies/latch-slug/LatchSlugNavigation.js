import { CastleResidentMotion } from "../../castle/residents/CastleResidentMotion.js";
import { NpcObstacleProbe } from "../../shared/NpcObstacleProbe.js";
import { LatchCompanionRoute } from "./LatchCompanionRoute.js";

/**
 * Reuses the production castle floor/stair planner as a look-ahead cursor.
 * Its setPosition writes ONLY a detached planning entity. The slug's real root
 * is moved exclusively by Enemy.moveToward and Ammo, never by this planner.
 */
export class LatchSlugNavigation {
  /**
   * @type {number}
   */
  crawlUntil = 0;
  /**
   * @returns {boolean}
   */
  get crawling() {
    return this.#owner.elapsed < this.crawlUntil;
  }
  /**
   * @type {import("./LatchSlug.js").LatchSlug}
   */
  #owner;
  /**
   * @type {import("../../../navigation/WalkingPaths.js").WalkingPoint[]|null}
   */
  #route = null;
  /**
   * @type {number}
   */
  #routeIndex = 0;
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
   * @type {LatchCompanionRoute}
   */
  #companionRoute;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #royalSeat = null;
  /**
   * @type {number}
   */
  #doorReach = 1.1;
  /**
   * @type {number}
   */
  #measureDoorAfter = 0;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #detour = null;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.#owner = owner;
    this.#cursor = new owner.pc.Entity("Latch Slug route cursor (not rendered)");
    this.#probe = new NpcObstacleProbe(owner.app);
    this.#companionRoute = new LatchCompanionRoute(owner, this.#blocked.bind(this));
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  canApproachCompanion(target) {
    return this.#companionRoute.next(target) !== null;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  canCloseCompanionGap(target) {
    const next = this.#companionRoute.next(target);

    return Boolean(next && next.distance(this.#owner.position) > 0.025);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {{position:import("playcanvas").Vec3, crowdChecked?: boolean}|null}
   */
  next(target) {
    if (this.#companionRoute.active) {
      return {
        position: this.#companionRoute.next(target) ?? this.#owner.position.clone(),
        crowdChecked: true,
      };
    }
    if (!this.#owner.app?.systems?.rigidbody) {
      return null;
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
   * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => {
        const layout = actor.residence?.layout;
        if (!layout) {
          return false;
        }
        const local = layout.toLocal(destination.x, destination.z);

        return layout.walkableAreas.some(/**
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
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
     */
      (area) => local.x >= area.minX && local.x <= area.maxX &&
      local.z >= area.minZ && local.z <= area.maxZ && Math.abs(area.floorY - owner.position.y) < 0.5);
    {
      const doors = [...castle.entranceDoors];
      doors.sort(/**
   * @param {import("../../architecture/door/Door.js").Door} a
   * @param {import("../../architecture/door/Door.js").Door} b
       */
        (a, b) => a.entity.getPosition().distance(owner.position) - b.entity.getPosition().distance(owner.position));
      if (doors.length) {
        const nearest = doors[0].entity.getPosition();
        const group = doors.filter(/**
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
   * @param {import("../../architecture/door/Door.js").Door|null} ignoredDoor
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  #avoid(destination, ignoredDoor = null) {
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
    // Keep local steering inside EnemyPathLane's close-target range. Otherwise
    // the shared lane planner can replace an obstacle detour with forward intent.
    const reach = Math.min(distance, 0.65);
    const yaw = Math.atan2(dx, dz);
    let best = null;
    let bestScore = Infinity;
    for (const angle of [0, -30, 30, -60, 60, -90, 90, -120, 120]) {
      const heading = yaw + angle * Math.PI / 180;
      const point = origin.clone().add(new this.#owner.pc.Vec3(Math.sin(heading) * reach, 0, Math.cos(heading) * reach));
      const middle = origin.clone().lerp(origin, point, 0.5);
      if (this.#blocked(middle, ignoredDoor) || this.#blocked(point, ignoredDoor)) {
        continue;
      }
      if (angle === 0) {
        this.#detour = null;
        this.#step(point);

        return { position: point };
      }
      if (this.#detour) {
        const detourMiddle = origin.clone().lerp(origin, this.#detour, 0.5);
        if (origin.distance(this.#detour) > 0.1 &&
          !this.#blocked(detourMiddle, ignoredDoor) && !this.#blocked(this.#detour, ignoredDoor)) {
          this.#step(this.#detour);

          return { position: this.#detour };
        }
        this.#detour = null;
      }
      const score = Math.hypot(destination.x - point.x, destination.z - point.z) + Math.abs(angle) * 0.002;
      if (score < bestScore) {
        best = point;
        bestScore = score;
      }
    }

    if (best) {
      // Finish the chosen step before choosing another side around the peer.
      this.#detour = best;
      this.#step(best);
    }

    return { position: best ?? origin.clone() };
  }

  /**
   * Include every live leaf: the generic prop probe intentionally omits castle bodies.
   * @param {import("playcanvas").Vec3} point
   * @param {import("../../architecture/door/Door.js").Door|null} ignoredDoor
   * @returns {boolean}
   */
  #blocked(point, ignoredDoor = null) {
    if (this.#probe.blockedAt(point)) {
      return true;
    }
    for (const actor of this.#owner.actors) {
      if (actor.isBellBug && actor.alive && !actor.carrier && actor.entity?.rigidbody && actor.entity.rigidbody.enabled !== false) {
        const position = this.#owner.targetPosition(actor);
        const overlapsHeight = position.y < point.y + this.#owner.height &&
          position.y + actor.height > point.y;
        const clearance = this.#owner.radius + (actor.footprintRadius ?? actor.radius) + 0.05;
        const origin = this.#owner.position;
        const distance = Math.hypot(point.x - position.x, point.z - position.z);
        const separating = (origin.x - position.x) * (point.x - origin.x) +
          (origin.z - position.z) * (point.z - origin.z) > 0;
        if (overlapsHeight && distance < clearance && !separating) {
          return true;
        }
      }
      for (const door of actor.destructibleDoors ?? actor.entranceDoors ?? []) {
        if (door !== ignoredDoor && door.blocksCameraAt?.(point.x, point.y + this.#owner.height / 2, point.z, this.#owner.radius + 0.04)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * A slow contact motor climbs a measured tread without a ballistic hop.
   * Ammo still integrates gravity and resolves the capsule against each riser.
   * @param {import("playcanvas").Vec3} destination
   */
  #step(destination) {
    const owner = this.#owner;
    const body = owner.entity.rigidbody;
    if (!body || owner.airborne || owner.carrier) {
      return;
    }
    if (owner.stairCrawl?.active) {
      this.#grip(owner.stairCrawl.targetHeight - owner.position.y);

      return;
    }
    const direction = destination.clone().sub(owner.position);
    direction.y = 0;
    if (direction.length() < 0.001) {
      return;
    }
    direction.normalize();
    const options = {
      /**
   * @param {import("playcanvas").Entity} entity
       */
      filterCallback: (entity) => entity.rigidbody?.type === "static",
    };
    let rise = 0, reach = 0, stepPoint = null;
    for (const distance of [owner.radius * 0.45, owner.radius * 0.72, owner.radius, owner.radius + 0.15]) {
      const ahead = owner.position.clone().add(direction.clone().mulScalar(distance));
      const hit = owner.app.systems.rigidbody.raycastFirst(ahead.clone().add(new owner.pc.Vec3(0, 0.32, 0)), ahead.clone().add(new owner.pc.Vec3(0, -0.32, 0)), options);
      const difference = hit ? hit.point.y - owner.position.y : 0;
      if (hit?.normal.y >= 0.75 && Math.abs(difference) >= 0.035 && Math.abs(difference) <= 0.28) {
        rise = difference;
        reach = distance;
        stepPoint = hit.point;
        break;
      }
    }
    if (!reach) {
      return;
    }
    direction.mulScalar(reach);
    const upper = owner.position.clone().add(new owner.pc.Vec3(0, owner.height * 0.7, 0));
    if (owner.app.systems.rigidbody.raycastFirst(upper, upper.clone().add(direction), options)) {
      return;
    }
    if (rise > 0 && owner.stairCrawl) {
      owner.stairCrawl.begin(stepPoint, direction);
      rise = 0;
    }
    this.#grip(rise);
  }

  /**
   * @param {number} rise
   */
  #grip(rise) {
    const owner = this.#owner, body = owner.entity.rigidbody;
    const velocity = body.linearVelocity;
    this.crawlUntil = owner.elapsed + 0.25;
    // Counter gravity only while gripping a measured tread. This keeps the
    // slow contact motor effective across Ammo substeps at lower frame rates.
    body.applyForce?.(0, body.mass * Math.abs(owner.app.systems.rigidbody.gravity.y), 0);
    body.linearVelocity = new owner.pc.Vec3(velocity.x, Math.max(-0.6, Math.min(0.6, rise * 4)), velocity.z);
  }

  /**
   * @param {import("../../castle/Castle.js").Castle} castle
   */
  #attach(castle) {
    this.#motion?.stop();
    this.#castle = castle;
    const layout = castle.residence.layout;
    const entryAreas = castle.entranceDoors.map(/**
   * @param {import("../../architecture/door/Door.js").Door} door
     */
      (door) => {
        const p = layout.toLocal(door.entity.getPosition().x, door.entity.getPosition().z);

        return {
          minX: p.x - 0.9,
          maxX: p.x + 0.9,
          minZ: p.z - 0.9,
          maxZ: p.z + 0.9,
          floorY: layout.origin.y,
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
        entity: this.#cursor,
        pose: ()=>{},
      },
      layout: planningLayout,
      /**
   * @param {import("playcanvas").Vec3} point
   * @param {boolean} avoidDoors
   * @param {boolean} includeProps
       */
      blocked: (point, avoidDoors, includeProps = true) => castle.residence.blocksMovementAt(point.x, point.z, this.#owner.radius, point.y) ||
        (includeProps && this.#probe.blockedAt(point)),
      // Closed leaves remain obstacles. This slug enters doors opened by gameplay.
      /**
   * @param {import("playcanvas").Vec3|null} point
       */
      clear: (point) => !point || !castle.destructibleDoors.some(/**
   * @param {import("../../architecture/door/Door.js").Door} door
       */
        (door) => door.blocksCameraAt(point.x, point.y + 0.4, point.z, this.#owner.radius)),
    });
  }

  /**
   * Follow the chosen gate lane until a nearby companion or door takes priority.
   * @returns {boolean}
   */
  advanceRoute() {
    const owner = this.#owner, map = owner.runtime.mapData;
    const gate = map?.objects?.find(/**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} o
     */
      o => o.id === owner.definition.gatewayId);
    const path = map?.paths?.find(/**
   * @param {{entry:import("../../../navigation/WalkingPaths.js").WalkingEntry,route:import("../../../navigation/WalkingPaths.js").WalkingPoint[]}} p
     */
      p => p.entry.col === gate?.entry?.col && p.entry.rows[0] === gate?.entry?.rows[0]);
    if (!path?.route?.length) {
      return false;
    }
    const points = path.route.map(/**
   * @param {import("../../../navigation/WalkingPaths.js").WalkingPoint} p
   * @param {number} index
     */
      (p, index) => owner.pathLane.routePoint(path.route, index));
    if (this.#route !== path.route || points[this.#routeIndex]?.distance(owner.position) > 2.5) {
      this.#route = path.route;
      this.#routeIndex = points.reduce(/**
   * @param {number} best
   * @param {import("playcanvas").Vec3} p
   * @param {number} i
       */
        (best, p, i) => p.distance(owner.position) < points[best].distance(owner.position) ? i : best, 0);
    }
    while (this.#routeIndex < points.length) {
      const point = points[this.#routeIndex], next = points[this.#routeIndex + 1];
      const distance = point.distance(owner.position);
      const passed = next && distance < 1.2 && Math.abs(point.y - owner.position.y) < 0.4 &&
        (owner.position.x - point.x) * (next.x - point.x) +
        (owner.position.z - point.z) * (next.z - point.z) >= 0;
      if (distance >= 0.45 && !passed) {
        break;
      }
      this.#routeIndex++;
    }
    const destination = points[this.#routeIndex];
    if (!destination) {
      return false;
    }
    const next = this.#avoid(destination);
    owner.moveToward(next, 0.85, 0.025);

    return true;
  }

  /**
   * Walk the authored exterior flight before committing the door leap.
   * @param {import("../../architecture/door/Door.js").Door} door
   * @returns {boolean}
   */
  approachDoor(door) {
    const owner = this.#owner;
    const position = door.entity.getPosition();
    const nearLeaf = Math.hypot(position.x - owner.position.x, position.z - owner.position.z) <= owner.radius + 0.55;
    if (position.y - owner.position.y <= 0.3 && nearLeaf && !owner.stairCrawl?.active) {
      return false;
    }
    const normal = door.entity.forward.clone();
    if (owner.position.clone().sub(position).dot(normal) < 0) {
      normal.mulScalar(-1);
    }
    const landing = position.clone().add(normal.mulScalar(owner.radius + 0.12));
    const castle = owner.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      actor => actor.destructibleDoors?.includes(door) && typeof actor.capsuleSupportHeightAt === "function");
    const support = castle?.capsuleSupportHeightAt(landing.x, landing.z);
    if (!Number.isFinite(support)) {
      return false;
    }
    landing.y = support;
    owner.moveToward(this.#avoid(landing, door), 0.7, 0.025);

    return true;
  }

  destroy() {
    this.#motion?.stop();
    this.#probe.destroy();
    this.#cursor.destroy();
  }
}

import { Vector3, Vehicle } from "yuka";
import { math } from "playcanvas";
import { castleStraightStairSurfaces } from "../stairs/CastleStraightStairs.js";

/**
 * @typedef {{entity:import("playcanvas").Entity,behavior?:import("../../shared/NpcStateMachine.js").NpcStateMachine,pose:(action:string,time:number) => void,settleNavigationOffset?:() => boolean,locomotionStride?:number,supportsStairAnimation?:boolean,alignFeet?:(surfaceHeight:(x:number,z:number,elevation:number) => number|null) => void}} ResidentActor
 * @typedef {{point:import("playcanvas").Vec3,links:ResidentRouteNode[],ix?:number,iz?:number,y?:number}} ResidentRouteNode
 */

/**
 * Routes a resident through authored floors and stair flights at walking speed.
 */
export class CastleResidentMotion {
  /**
   * @type {number}
   */
  #carryRadius = 0;
  /**
   * @type {WeakSet<import("playcanvas").Vec3>}
   */
  #stairPoints = new WeakSet();
  /**
   * @type {number}
   */
  #yaw = 0;
  /**
   * @type {boolean}
   */
  #moving = false;
  /**
   * @type {import("./CastleResidentialLayout.js").CastleResidentialLayout}
   */
  #layout;
  /**
   * @type {ResidentRouteNode[]}
   */
  #nodes = [];
  /**
   * @type {(point:import("playcanvas").Vec3,avoidDoors?:boolean,includeProps?:boolean) => boolean}
   */
  #blocked;
  /**
   * @type {(point:import("playcanvas").Vec3|null,operator:import("playcanvas").Entity) => boolean}
   */
  #clear;
  /**
   * @type {ResidentActor}
   */
  #actor;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #home;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #target = null;
  /**
   * @type {string}
   */
  #walkAction = "walk";
  /**
   * @type {import("playcanvas").Vec3[]|null}
   */
  #route = null;
  /**
   * @type {Vehicle}
   */
  #vehicle = new Vehicle();
  /**
   * @type {number}
   */
  #time = 0;
  /**
   * @type {number}
   */
  #retry = 0;
  /**
   * @type {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}|null}
   */
  #homeArea;
  /**
   * @type {boolean}
   */
  #homeRelocated = false;

  /**
   * @param {{actor:ResidentActor,layout:import("./CastleResidentialLayout.js").CastleResidentialLayout,blocked:(point:import("playcanvas").Vec3,avoidDoors?:boolean,includeProps?:boolean) => boolean,clear:(point:import("playcanvas").Vec3|null,operator:import("playcanvas").Entity) => boolean,homeArea?:{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}}} options
   */
  constructor({ actor, layout, blocked, clear, homeArea = null }) {
    this.#actor = actor;
    this.#layout = layout;
    actor.carryStairs = [...layout.authoredStairs, layout.stairs, layout.serviceStair].filter(Boolean);
    this.#blocked = blocked;
    this.#clear = clear;
    this.#homeArea = homeArea;
    this.#home = actor.entity.getPosition().clone();
    // Euler decomposition can report Y=0 for a root facing 180 degrees.
    // Read its heading from the forward vector to preserve the loaded pose.
    this.#yaw = Math.atan2(-actor.entity.forward.x, -actor.entity.forward.z) * 180 / Math.PI;
    this.#vehicle.maxSpeed = 1.2;
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get home() {
    return this.#home;
  }
  /**
   * @returns {boolean}
   */
  get arrived() {
    return this.#route?.length === 0 && this.#target !== null && this.#actor.entity.getPosition().distance(this.#target) < 0.025;
  }

  /**
   * Cancels travel at the current position and releases doorway requests.
   */
  stop() {
    this.#moving = false;
    this.#route = null;
    this.#target = null;
    this.#clear(null, this.#actor.entity);
  }

  /**
   * @param {import("playcanvas").Vec3} target
   * @param {string} action
   */
  moveTo(target, action = "walk") {
    this.#walkAction = action;
    const radius = action === "carry" ? Math.max(0.5, this.#actor.carryTurnRadius ?? 0) : 0;
    if (Math.abs(radius - this.#carryRadius) > 0.001) {
      this.#carryRadius = radius;
      this.#nodes = [];
      this.#target = null;
    }
    if (this.#homeArea && target.distance(this.#home) < 0.01 &&
      (!this.#homeRelocated || this.#blocked(target, true))) {
      this.#relocateHome();
      target = this.#home;
    }
    if (this.#target?.distance(target) < 0.01) {
      return;
    }
    this.#target = target.clone();
    this.#moving = false;
    this.#route = this.#find(this.#actor.entity.getPosition(), target);
  }

  /**
   * Use a free interior standing spot, away from doorway swing reservations.
   */
  #relocateHome() {
    if (this.#nodes.length === 0) {
      this.#build();
    }
    let nearest = null;
    let distance = Infinity;
    for (const node of this.#nodes) {
      if (Math.abs(node.point.y - this.#homeArea.floorY) > 0.01) {
        continue;
      }
      const local = this.#layout.toLocal(node.point.x, node.point.z);
      const separation = Math.hypot(local.x - (this.#homeArea.minX + this.#homeArea.maxX) / 2,
        local.z - (this.#homeArea.minZ + this.#homeArea.maxZ) / 2);
      if (separation >= distance) {
        continue;
      }
      if (local.x < this.#homeArea.minX || local.x > this.#homeArea.maxX ||
        local.z < this.#homeArea.minZ || local.z > this.#homeArea.maxZ || this.#blocked(node.point, true)) {
        continue;
      }
      nearest = node.point;
      distance = separation;
    }
    if (nearest) {
      this.#home.copy(nearest);
      this.#homeRelocated = true;
    }
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this.#target && this.#route?.length !== 0 && this.#actor.settleNavigationOffset?.()) {
      this.#moving = false;
      this.#route = this.#find(this.#actor.entity.getPosition(), this.#target);
    }
    this.#retry = Math.max(0, this.#retry - deltaTime);
    if (!this.#route && this.#target && this.#retry === 0) {
      this.#route = this.#find(this.#actor.entity.getPosition(), this.#target);
      this.#retry = 0.5;
    }
    if (!this.#route?.length) {
      return;
    }
    this.#clear(this.#actor.entity.getPosition(), this.#actor.entity);
    if (this.#actor.behavior?.reacting) {
      this.#moving = false;

      return;
    }
    const entity = this.#actor.entity;
    const position = entity.getPosition().clone();
    const stepTime = Math.min(deltaTime, 0.1);
    const heading = this.#route[0].clone().sub(position);
    if (this.#carryRadius > 0 && this.#route.length > 1 &&
      this.#stairPoints.has(this.#route[0]) && this.#stairPoints.has(this.#route[1]) &&
      Math.abs(heading.y) < 0.02 && Math.abs(this.#route[1].y - position.y) < 0.02) {
      // Begin the loaded pivot before reaching the landing corner. Waiting
      // until the carrier stops there swings the leading edge into the back
      // wall, even though the carrier's own footprint fits the landing.
      const blend = math.clamp(1 - heading.length() / 0.65, 0, 1);
      heading.lerp(heading, this.#route[1].clone().sub(this.#route[0]), blend);
    }
    const targetYaw = Math.hypot(heading.x, heading.z) > 0.001
      ? Math.atan2(heading.x, heading.z) * 180 / Math.PI : this.#yaw;
    const yawError = ((targetYaw - this.#yaw) % 360 + 540) % 360 - 180;
    const turn = math.clamp(yawError * (1 - Math.exp(-10 * stepTime)), -240 * stepTime, 240 * stepTime);
    this.#yaw += turn;
    entity.setEulerAngles(0, this.#yaw, 0);
    // Turn toward travel before stepping, rather than sliding sideways while
    // the body catches up. Apply rotation once per frame, not per grid point.
    const facingError = Math.abs(yawError - turn);
    const facingTravel = facingError <= (this.#moving ? 45 : 15);
    let remaining = facingTravel ? this.#vehicle.maxSpeed * stepTime *
      Math.max(0, Math.cos(facingError * Math.PI / 180)) : 0;
    while (remaining > 0 && this.#route.length) {
      const next = this.#route[0];
      const direction = next.clone().sub(position);
      const distance = direction.length();
      const step = Math.min(remaining, distance);
      const candidate = position.clone().add(direction.clone().normalize().mulScalar(step));
      if (!this.#clear(candidate, entity) || !this.#collisionFree(position, candidate, true)) {
        if (this.#retry === 0) {
          // A moving leaf can temporarily seal the graph. Keep a furniture
          // detour available; every actual step still waits for door clearance.
          const detour = this.#find(position, this.#target, true) ??
            this.#find(position, this.#target);
          if (detour) {
            this.#route = detour;
          }
          this.#retry = 0.5;
        }
        break;
      }
      position.copy(candidate);
      this.#vehicle.position.set(position.x, position.y, position.z);
      this.#vehicle.velocity.copy(new Vector3(direction.x, direction.y, direction.z).normalize().multiplyScalar(this.#vehicle.maxSpeed));
      remaining -= step;
      if (distance <= step + 0.00001) {
        this.#route.shift();
      }
    }
    const distanceMoved = position.distance(entity.getPosition());
    const elevationChange = position.y - entity.getPosition().y;
    const moved = distanceMoved > 0.00001;
    this.#moving = moved;
    this.#time += distanceMoved / (this.#actor.locomotionStride ?? 1.2);
    entity.setPosition(position);
    // Steering owns yaw. Keep a standing pose during pivots instead of layering
    // a baked turn clip's visual-root rotation on top of navigation rotation.
    let action = moved || this.#walkAction === "carry" ? this.#walkAction : "idle";
    if (moved && this.#actor.supportsStairAnimation && Math.abs(elevationChange) > 0.0001) {
      action = this.#walkAction === "carry"
        ? (elevationChange > 0 ? "carryStairUp" : "carryStairDown")
        : (elevationChange > 0 ? "stairUp" : "stairDown");
    }
    this.#actor.pose(action, moved ? this.#time : 0);
    if (this.#layout.surfaceHeightAt) {
      this.#actor.alignFeet?.(this.#surfaceHeight.bind(this));
    }
    if (!this.#route.length) {
      this.#clear(null, entity);
    }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} y
   */
  #floor(x, z, y) {
    return this.#layout.walkableAreas.some(/**
     *
     * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
     */
      // Seated homes can sit on a low throne dais above the room floor.
      (area) => Math.abs(area.floorY - y) <= 0.32 &&
      x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ);
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @returns {number|null}
   */
  #surfaceHeight(x, z, elevation) {
    return this.#layout.surfaceHeightAt(x, z, elevation, this.#actor);
  }

  #build() {
    this.#stairPoints = new WeakSet();
    const lookup = new Map();
    for (const area of this.#layout.walkableAreas) {
      for (let ix = Math.ceil(area.minX * 8); ix <= Math.floor(area.maxX * 8); ix++) {
        for (let iz = Math.ceil(area.minZ * 8); iz <= Math.floor(area.maxZ * 8); iz++) {
          const key = `${ix}:${iz}:${area.floorY}`;
          if (lookup.has(key)) {
            continue;
          }
          const point = this.#point(ix / 8, iz / 8, area.floorY);
          // Furniture can move after construction. Keep its floor nodes and
          // validate the live prop geometry when selecting and following routes.
          if (this.#blocked(point, false, false)) {
            continue;
          }
          const node = {
            point,
            links: [],
            ix,
            iz,
            y: area.floorY,
          };
          lookup.set(key, node);
          this.#nodes.push(node);
        }
      }
    }
    for (const node of this.#nodes) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbor = lookup.get(`${node.ix + dx}:${node.iz + dz}:${node.y}`);
        if (neighbor && this.#segment(node.point, neighbor.point, false, false)) {
          node.links.push(neighbor);
        }
      }
    }
    for (const stair of [...this.#layout.authoredStairs, this.#layout.stairs].filter(Boolean)) {
      let points;
      if (stair.straight) {
        const [up, landing, down] = castleStraightStairSurfaces(stair);
        const left = (up.minX + up.maxX) / 2;
        const right = (down.minX + down.maxX) / 2;
        const approach = stair.approachDepth ?? 0.2;
        const turn = Math.max(landing.minZ + 0.15,
          Math.min((landing.minZ + landing.maxZ) / 2, landing.maxZ - this.#carryRadius));
        points = [[left, up.maxZ + approach, 0], [left, up.maxZ, 0],
          [left, up.minZ, up.high], [left, turn, up.high], [right, turn, up.high],
          [right, down.minZ, down.low], [right, down.maxZ, down.high],
          [right, up.maxZ + approach, stair.rise]].map(/**
           *
           * @param {number[]} options
           * @param {number} options."0"
           * @param {number} options."1"
           * @param {number} options."2"
           */
          ([x, z, y]) => {
            const angle = stair.yaw * Math.PI / 180;
            const point = this.#actor.entity.getPosition().clone();
            point.set(stair.center.x + Math.cos(angle) * x + Math.sin(angle) * z,
              stair.center.y + y, stair.center.z - Math.sin(angle) * x + Math.cos(angle) * z);

            return point;
          });
      } else {
        points = stair.treads.map(this.#mapPoint.bind(this));
      }
      const route = points.map(CastleResidentMotion.#mapPoint2);
      for (const point of points) {
        this.#stairPoints.add(point);
      }
      for (let index = 1; index < route.length; index++) {
        route[index - 1].links.push(route[index]); route[index].links.push(route[index - 1]);
      }
      for (const end of [route[0], route.at(-1)]) {
        for (const node of this.#nodes) {
          if (Math.abs(node.point.y - end.point.y) < 0.31 && node.point.distance(end.point) < 0.8 &&
            !this.#blocked(node.point.clone().add(end.point).mulScalar(0.5), false, false)) {
            node.links.push(end); end.links.push(node);
          }
        }
      }
      this.#nodes.push(...route);
    }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} y
   */
  #point(x, z, y) {
    const world = this.#layout.toWorld(x, z, y - this.#layout.origin.y);

    return this.#actor.entity.getPosition().clone().set(world.x, world.y, world.z);
  }

  /**
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {boolean} avoidDoors
   * @param {boolean} includeProps
   */
  #segment(start, end, avoidDoors = false, includeProps = true) {
    const steps = Math.ceil(start.distance(end) / 0.1);
    for (let step = 0; step <= steps; step++) {
      const point = start.clone().lerp(start, end, step / Math.max(1, steps));
      const local = this.#layout.toLocal(point.x, point.z);
      if (!this.#floor(local.x, local.z, end.y) || this.#blocked(point, avoidDoors, includeProps)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Query the scene's collider footprints along movement, including stair edges
   * where floor-only route validation does not apply.
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {boolean} avoidDoors
   * @returns {boolean}
   */
  #collisionFree(start, end, avoidDoors = false) {
    const steps = Math.max(1, Math.ceil(start.distance(end) / 0.02));
    for (let step = 0; step <= steps; step++) {
      if (this.#blocked(start.clone().lerp(start, end, step / steps), avoidDoors)) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} target
   * @param {boolean} avoidDoors
   */
  #find(start, target, avoidDoors = false) {
    // Scene parenting and collider registration finish after residents are
    // constructed. Build against their final transforms on the first journey.
    if (this.#nodes.length === 0) {
      this.#build();
    }
    const source = {
      point: start,
      links: [],
    };
    const goal = {
      point: target,
      links: [],
    };
    const goalNeighbors = new Set();
    for (const node of this.#nodes) {
      if (Math.abs(node.point.y - start.y) < 0.5 && node.point.distance(start) < 0.9 && this.#segment(start, node.point, avoidDoors)) {
        source.links.push(node);
      }
      if (Math.abs(node.point.y - target.y) < 0.5 && node.point.distance(target) < 0.9 && this.#segment(node.point, target, avoidDoors)) {
        goalNeighbors.add(node);
      }
    }
    if (source.links.length === 0 || goalNeighbors.size === 0) {
      return null;
    }
    // Recompute clearance for each journey: furniture and doors can move.
    // A soft cost keeps narrow passages usable and preserves exact task targets.
    const clearanceCosts = new Map();
    const costs = new Map([[source, 0]]), previous = new Map(), open = new Set([source]);
    while (open.size) {
      let current = null, score = Infinity;
      for (const node of open) {
        const value = costs.get(node) + node.point.distance(target);
        if (value < score) {
          current = node; score = value;
        }
      }
      if (current === goal) {
        const route = [];
        for (let node = goal; node !== source; node = previous.get(node)) {
          route.unshift(node.point);
        }

        return this.#smoothRoute(start, route, avoidDoors);
      }
      open.delete(current);
      for (const neighbor of [...current.links, ...(goalNeighbors.has(current) ? [goal] : [])]) {
        if (!this.#collisionFree(current.point, neighbor.point, avoidDoors)) {
          continue;
        }
        if (!clearanceCosts.has(neighbor)) {
          clearanceCosts.set(neighbor, neighbor === goal ? 1 : this.#clearanceCost(neighbor.point));
        }
        const cost = costs.get(current) + current.point.distance(neighbor.point) * clearanceCosts.get(neighbor);
        if (cost >= (costs.get(neighbor) ?? Infinity)) {
          continue;
        }
        costs.set(neighbor, cost); previous.set(neighbor, current); open.add(neighbor);
      }
    }

    return null;
  }

  /**
   * Remove grid-sized zigzags without straightening away the center preference,
   * then round floor corners. Stair flights retain their authored profile.
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3[]} route
   * @param {boolean} avoidDoors
   * @returns {import("playcanvas").Vec3[]}
   */
  #smoothRoute(start, route, avoidDoors) {
    const points = [start, ...route];
    const simplified = [start];
    for (let index = 0; index < points.length - 1;) {
      let last = index + 1;
      for (let end = index + 2; end < points.length; end++) {
        if (this.#stairPoints.has(points[index + 1]) || this.#stairPoints.has(points[end])) {
          break;
        }
        const direction = points[end].clone().sub(points[index]);
        if (Math.abs(direction.y) > 0.0001) {
          break;
        }
        let close = true;
        for (let middle = index + 1; middle < end; middle++) {
          const offset = points[middle].clone().sub(points[index]);
          const fraction = math.clamp(offset.dot(direction) / Math.max(0.000001, direction.lengthSq()), 0, 1);
          const projected = points[index].clone().add(direction.clone().mulScalar(fraction));
          if (Math.abs(offset.y) > 0.0001 || projected.distance(points[middle]) > 0.1) {
            close = false;
            break;
          }
        }
        if (!close || !this.#segment(points[index], points[end], avoidDoors)) {
          break;
        }
        last = end;
      }
      simplified.push(points[last]);
      index = last;
    }
    const rounded = [];
    for (let index = 1; index < simplified.length - 1; index++) {
      const before = simplified[index - 1], corner = simplified[index], after = simplified[index + 1];
      const distance = Math.min(0.5, before.distance(corner) / 2, corner.distance(after) / 2);
      if (this.#stairPoints.has(corner) || Math.abs(before.y - corner.y) > 0.0001 || Math.abs(after.y - corner.y) > 0.0001 || distance < 0.025) {
        rounded.push(corner);
        continue;
      }
      const entry = corner.clone().lerp(corner, before, distance / corner.distance(before));
      const exit = corner.clone().lerp(corner, after, distance / corner.distance(after));
      const curve = [entry];
      let clear = true;
      const steps = Math.ceil(distance * 2 / 0.08);
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const point = entry.clone().mulScalar((1 - t) ** 2)
          .add(corner.clone().mulScalar(2 * (1 - t) * t)).add(exit.clone().mulScalar(t ** 2));
        if (!this.#segment(curve.at(-1), point, avoidDoors)) {
          clear = false;
          break;
        }
        curve.push(point);
      }
      rounded.push(...(clear ? curve : [corner]));
    }
    rounded.push(simplified.at(-1));

    return rounded;
  }

  /**
   * Prefer the middle of free floor space rather than the shortest wall edge.
   * Collision queries already include the resident's body radius. Sample beyond
   * that footprint, including diagonals so corners receive the same preference.
   * @param {import("playcanvas").Vec3} point
   * @returns {number}
   */
  #clearanceCost(point) {
    const sample = point.clone();
    for (let distance = 0.125; distance <= 1.5; distance += 0.125) {
      for (let direction = 0; direction < 8; direction++) {
        const angle = direction * Math.PI / 4;
        sample.set(point.x + Math.cos(angle) * distance, point.y,
          point.z + Math.sin(angle) * distance);
        const local = this.#layout.toLocal(sample.x, sample.z);
        if (!this.#floor(local.x, local.z, point.y) || this.#blocked(sample, false)) {
          return 1 + 6 * (1 - distance / 1.5) ** 2;
        }
      }
    }

    return 1;
  }

  /**
   *
   * @param {import("playcanvas").Vec3} point
   */
  #mapPoint(point) {
    return this.#actor.entity.getPosition().clone().set(point.x, point.y, point.z);
  }

  /**
   *
   * @param {import("playcanvas").Vec3} point
   */
  static #mapPoint2(point) {
    return {
      point,
      links: [],
    };
  }
}

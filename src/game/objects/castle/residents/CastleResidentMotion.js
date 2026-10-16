import { Vector3, Vehicle } from "yuka";
import { castleStraightStairSurfaces } from "../stairs/CastleStraightStairs.js";

/**
 * @typedef {{entity:import("playcanvas").Entity,behavior?:import("../../shared/NpcStateMachine.js").NpcStateMachine,pose:(action:string,time:number) => void}} ResidentActor
 * @typedef {{point:import("playcanvas").Vec3,links:ResidentRouteNode[],ix?:number,iz?:number,y?:number}} ResidentRouteNode
 */

/**
 * Routes a resident through authored floors and stair flights at walking speed.
 */
export class CastleResidentMotion {
  /**
   * @type {import("./CastleResidentialLayout.js").CastleResidentialLayout}
   */
  #layout;
  /**
   * @type {ResidentRouteNode[]}
   */
  #nodes = [];
  /**
   * @type {(point:import("playcanvas").Vec3,avoidDoors?:boolean) => boolean}
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
   * @param {{actor:ResidentActor,layout:import("./CastleResidentialLayout.js").CastleResidentialLayout,blocked:(point:import("playcanvas").Vec3,avoidDoors?:boolean) => boolean,clear:(point:import("playcanvas").Vec3|null,operator:import("playcanvas").Entity) => boolean}} options
   */
  constructor({ actor, layout, blocked, clear }) {
    this.#actor = actor;
    this.#layout = layout;
    this.#blocked = blocked;
    this.#clear = clear;
    this.#home = actor.entity.getPosition().clone();
    this.#vehicle.maxSpeed = 1.2;
    this.#build();
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
    if (this.#target?.distance(target) < 0.01) {
      return;
    }
    this.#target = target.clone();
    this.#route = this.#find(this.#actor.entity.getPosition(), target);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
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
      return;
    }
    this.#time += deltaTime;
    let remaining = this.#vehicle.maxSpeed * Math.min(deltaTime, 0.1);
    const entity = this.#actor.entity;
    const position = entity.getPosition().clone();
    while (remaining > 0 && this.#route.length) {
      const next = this.#route[0];
      const direction = next.clone().sub(position);
      const distance = direction.length();
      const step = Math.min(remaining, distance);
      const candidate = position.clone().add(direction.clone().normalize().mulScalar(step));
      if (!this.#clear(candidate, entity) || !this.#collisionFree(position, candidate, true)) {
        if (this.#retry === 0) {
          const detour = this.#find(position, this.#target, true);
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
      if (Math.hypot(direction.x, direction.z) > 0.001) {
        entity.setEulerAngles(0, Math.atan2(direction.x, direction.z) * 180 / Math.PI, 0);
      }
      remaining -= step;
      if (distance <= step + 0.00001) {
        this.#route.shift();
      }
    }
    const moved = position.distance(entity.getPosition()) > 0.00001;
    entity.setPosition(position);
    this.#actor.pose(moved || this.#walkAction === "carry" ? this.#walkAction : "idle", this.#time);
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
      (area) => Math.abs(area.floorY - y) < 0.01 &&
      x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ);
  }

  #build() {
    const lookup = new Map();
    for (const area of this.#layout.walkableAreas) {
      for (let ix = Math.ceil(area.minX * 8); ix <= Math.floor(area.maxX * 8); ix++) {
        for (let iz = Math.ceil(area.minZ * 8); iz <= Math.floor(area.maxZ * 8); iz++) {
          const key = `${ix}:${iz}:${area.floorY}`;
          if (lookup.has(key)) {
            continue;
          }
          const point = this.#point(ix / 8, iz / 8, area.floorY);
          if (this.#blocked(point)) {
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
        if (neighbor && this.#segment(node.point, neighbor.point)) {
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
        const turn = (landing.minZ + landing.maxZ) / 2;
        points = [[left, up.maxZ + 0.2, 0], [left, up.maxZ, 0],
          [left, up.minZ, up.high], [left, turn, up.high], [right, turn, up.high],
          [right, down.minZ, down.low], [right, down.maxZ, down.high],
          [right, up.maxZ + 0.2, stair.rise]].map(/**
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
      for (let index = 1; index < route.length; index++) {
        route[index - 1].links.push(route[index]); route[index].links.push(route[index - 1]);
      }
      for (const end of [route[0], route.at(-1)]) {
        for (const node of this.#nodes) {
          if (Math.abs(node.point.y - end.point.y) < 0.31 && node.point.distance(end.point) < 0.8 &&
            !this.#blocked(node.point.clone().add(end.point).mulScalar(0.5))) {
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
   */
  #segment(start, end, avoidDoors = false) {
    const steps = Math.ceil(start.distance(end) / 0.1);
    for (let step = 0; step <= steps; step++) {
      const point = start.clone().lerp(start, end, step / Math.max(1, steps));
      const local = this.#layout.toLocal(point.x, point.z);
      if (!this.#floor(local.x, local.z, end.y) || this.#blocked(point, avoidDoors)) {
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
    const steps = Math.max(1, Math.ceil(start.distance(end) / 0.05));
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

        return route;
      }
      open.delete(current);
      for (const neighbor of [...current.links, ...(goalNeighbors.has(current) ? [goal] : [])]) {
        if (!this.#collisionFree(current.point, neighbor.point, avoidDoors)) {
          continue;
        }
        const cost = costs.get(current) + current.point.distance(neighbor.point);
        if (cost >= (costs.get(neighbor) ?? Infinity)) {
          continue;
        }
        costs.set(neighbor, cost); previous.set(neighbor, current); open.add(neighbor);
      }
    }

    return null;
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

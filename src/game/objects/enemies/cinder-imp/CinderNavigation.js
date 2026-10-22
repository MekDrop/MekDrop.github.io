import { CastleResidentMotion } from "../../castle/residents/CastleResidentMotion.js";
import { NpcObstacleProbe } from "../../shared/NpcObstacleProbe.js";

/**
 * Reuses the production castle floor/stair planner as a look-ahead cursor.
 * Its setPosition writes ONLY a detached planning entity. The imp's real root
 * is moved exclusively by Enemy.moveToward and Ammo, never by this planner.
 */
export class CinderNavigation {
  /**
   * @type {import("./CinderImp.js").CinderImp}
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
   * @param {import("./CinderImp.js").CinderImp} owner
   */
  constructor(owner) {
    this.#owner = owner;
    this.#cursor = new owner.pc.Entity("Cinder route cursor (not rendered)");
    this.#probe = new NpcObstacleProbe(owner.app);
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
    const destination = owner.targetPosition(target);
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
    this.#cursor.setPosition(owner.position);
    const layout = castle.residence.layout;
    const local = layout.toLocal(owner.position.x, owner.position.z);
    const inside = layout.walkableAreas.some(/**
     *
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
     */
      (area) => local.x >= area.minX && local.x <= area.maxX &&
      local.z >= area.minZ && local.z <= area.maxZ && Math.abs(area.floorY - owner.position.y) < 0.5);
    if (!inside) {
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
        if (entry.distance(owner.position) > 0.75) {
          return { position: entry };
        }
      }
    }
    this.#motion.moveTo(destination);
    this.#motion.update(owner.deltaTime);
    const point = this.#cursor.getPosition().clone();

    return point.distance(owner.position) > 0.001 ? { position: point } : null;
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
      // Closed leaves remain obstacles. This imp enters doors opened by gameplay.
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

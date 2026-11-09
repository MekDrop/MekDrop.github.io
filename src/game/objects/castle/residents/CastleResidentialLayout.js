import { AbstractCastleResidentialLayout } from "./AbstractCastleResidentialLayout.js";
import { SurfaceSpatialIndex } from "../../shared/SurfaceSpatialIndex.js";
import { STEP_CLEARANCE } from "../../characters/hero/HeroSurfaceRules.js";
import { CastleResidentialStairSurface } from "./CastleResidentialStairSurface.js";

/**
 * @typedef {import("./AbstractCastleResidentialLayout.js").ResidentialPoint} ResidentialPoint
 * @typedef {import("./AbstractCastleResidentialLayout.js").ResidentialRoom} ResidentialRoom
 * @typedef {import("./AbstractCastleResidentialLayout.js").ResidentialPlacement} ResidentialPlacement
 * @typedef {import("./AbstractCastleResidentialLayout.js").ResidentialStair} ResidentialStair
 */

/**
 * Runtime surface and access queries over constructed residential geometry.
 * Each layout owns its lazy floor index and current servant identity; neither
 * is shared with another castle or retained in the serialized build plan.
 */
export class CastleResidentialLayout extends AbstractCastleResidentialLayout {
  /**
   * @type {SurfaceSpatialIndex<{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}>|null}
   */
  #floorIndex = null;
  /**
   * @type {import("../rooms/terrace/TerraceActor.js").TerraceActor|null}
   */
  #servant = null;

  /**
   * @param {import("../rooms/terrace/TerraceActor.js").TerraceActor|null} actor
   */
  set servant(actor) {
    this.#servant = actor;
  }

  /**
   * @param {import("../rooms/terrace/TerraceActor.js").TerraceActor|null} actor
   */
  canEnterBasement(actor) {
    return (
      this.authoredStairs.some(this.#someStair.bind(this)) ||
      (this.#servant !== null && actor === this.#servant)
    );
  }

  /**
   * Select only a tread reachable from the caller's current level.
   * @param {import("../rooms/terrace/TerraceActor.js").TerraceActor|null} actor
   * @param {number} x
   * @param {number} z
   * @param {number} currentElevation
   */
  stairSurfaceHeightAt(x, z, currentElevation, actor = null) {
    const service = this.canEnterBasement(actor) ? this.serviceStair : null;
    const stairs = [...this.authoredStairs, this.stairs, service ? {
      ...service,
      innerRadius: service.radius * 0.08 / 0.65,
      steps: 24,
      turns: 1.5,
    } : null];

    return CastleResidentialStairSurface.heightAt(stairs, x, z, currentElevation);
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} currentElevation
   * @param {import("../rooms/terrace/TerraceActor.js").TerraceActor|null} actor
   */
  surfaceHeightAt(x, z, currentElevation, actor = null) {
    const stairHeight = this.stairSurfaceHeightAt(x, z, currentElevation, actor);
    if (stairHeight !== null) {
      return stairHeight;
    }
    const local = this.toLocal(x, z);
    if (!this.#floorIndex) {
      this.#floorIndex = new SurfaceSpatialIndex();
      for (const area of this.walkableAreas) {
        this.#floorIndex.add(area, area);
      }
    }
    for (const area of this.#floorIndex.query(local.x, local.z)) {
      if (area.floorY < this.origin.y && !this.canEnterBasement(actor)) {
        continue;
      }
      // The first authored tread can be 0.3 m high. Its adjoining floor must
      // remain queryable throughout the same step range used by the hero.
      if (Math.abs(area.floorY - currentElevation) <= STEP_CLEARANCE && local.x >= area.minX && local.x <= area.maxX && local.z >= area.minZ && local.z <= area.maxZ) {
        return area.floorY;
      }
    }
    // Authored floor areas already exclude stair openings.
    if (this.authoredStairs.length > 0) {
      return null;
    }
    for (const [name, room] of Object.entries(this.rooms)) {
      if (
        !room ||
        room.purpose === "upper hall" ||
        room.purpose === "upper terrace" ||
        room.purpose === "unused" ||
        (room.floorY < this.origin.y && !this.canEnterBasement(actor))
      ) {
        continue;
      }
      if (["servantBedroom", "storage"].includes(name) && !this.canEnterBasement(actor)) {
        continue;
      }
      if (Math.abs(room.floorY - currentElevation) <= 0.24 && local.x >= room.minX && local.x <= room.maxX && local.z >= room.minZ && local.z <= room.maxZ) {
        return room.floorY;
      }
    }

    return null;
  }

  /**
   * @param {{center:{y:number}}} stair
   */
  #someStair(stair) {
    return stair.center.y < this.origin.y;
  }
}

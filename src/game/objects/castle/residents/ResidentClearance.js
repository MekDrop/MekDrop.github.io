import { castleStraightStairSurfaces } from "../stairs/CastleStraightStairs.js";
import { SurfaceSpatialIndex } from "../../shared/SurfaceSpatialIndex.js";

/**
 * @typedef {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} ResidentFloorArea
 */

/**
 * Clearance against the castle's authored Ammo collider footprints. The wider
 * torso envelope applies to walls; low stair rails retain the foot capsule.
 */
export class ResidentClearance {
  /**
   * @type {WeakMap<import("./CastleResidentialLayout.js").CastleResidentialLayout, SurfaceSpatialIndex<ResidentFloorArea>>}
   */
  static #floorIndices = new WeakMap();

  /**
   * Test the foot capsule against the union of floors. Shrinking each room
   * separately creates an artificial unsupported strip across every doorway.
   * @param {import("./CastleResidentialLayout.js").CastleResidentialLayout} layout
   * @param {import("playcanvas").Vec3} point
   * @returns {boolean}
   */
  static isSupported(layout, point) {
    let index = this.#floorIndices.get(layout);
    if (!index) {
      index = new SurfaceSpatialIndex();
      for (const area of [...layout.walkableAreas, ...Object.values(layout.rooms)]) {
        if (area && Number.isFinite(area.floorY)) {
          index.add(area, area);
        }
      }
      this.#floorIndices.set(layout, index);
    }
    const local = layout.toLocal(point.x, point.z);
    if (!this.#supportedPoint(index, local.x, local.z, point.y)) {
      return false;
    }
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI / 4;
      if (!this.#supportedPoint(index, local.x + Math.cos(angle) * 0.22,
        local.z + Math.sin(angle) * 0.22, point.y)) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {SurfaceSpatialIndex<ResidentFloorArea>} index
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @returns {boolean}
   */
  static #supportedPoint(index, x, z, elevation) {
    for (const area of index.query(x, z)) {
      if (Math.abs(area.floorY - elevation) < 0.15 && x >= area.minX - 0.000001 &&
        x <= area.maxX + 0.000001 && z >= area.minZ - 0.000001 && z <= area.maxZ + 0.000001) {
        return true;
      }
    }

    return false;
  }
  /**
   * Covers the animated royal coat and sleeves with a small standing margin.
   * @returns {number}
   */
  static get wallRadius() {
    return 0.55;
  }

  /**
   * Stair flights and their short landing approaches own a narrower traversal
   * envelope. Do not inflate their rails or floor apertures into room walls.
   * @param {import("./CastleResidentialLayout.js").CastleResidentialLayout} layout
   * @param {import("playcanvas").Vec3} point
   * @returns {number}
   */
  static wallRadiusAt(layout, point) {
    for (const stair of [...layout.authoredStairs, layout.stairs, layout.serviceStair]) {
      if (!stair?.center || point.y < stair.center.y - 0.35 || point.y > stair.center.y + stair.rise + 0.35) {
        continue;
      }
      const dx = point.x - stair.center.x, dz = point.z - stair.center.z;
      if (!stair.straight) {
        if (Math.hypot(dx, dz) < stair.radius + 0.35) {
          return 0.22;
        }
        continue;
      }
      const angle = stair.yaw * Math.PI / 180;
      const x = Math.cos(angle) * dx - Math.sin(angle) * dz;
      const z = Math.sin(angle) * dx + Math.cos(angle) * dz;
      for (const surface of castleStraightStairSurfaces(stair)) {
        if (x >= surface.minX - 0.35 && x <= surface.maxX + 0.35 &&
          z >= surface.minZ - 0.35 && z <= surface.maxZ + 0.35) {
          return 0.22;
        }
      }
    }

    return this.wallRadius;
  }

  /**
   * @param {Iterable<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>} blocks
   * @param {import("playcanvas").Vec3} point
   * @param {number} wallRadius
   * @returns {boolean}
   */
  static blockedByWalls(blocks, point, wallRadius = this.wallRadius) {
    for (const block of blocks) {
      const bottom = block.y - block.halfY;
      const top = block.y + block.halfY;
      if (top <= point.y + 0.32 || bottom >= point.y + 1.6) {
        continue;
      }
      const radius = block.halfY * 2 >= 1.2 && top >= point.y + 1.2 ? wallRadius : 0.22;
      const dx = Math.max(0, Math.abs(point.x - block.x) - block.halfX);
      const dz = Math.max(0, Math.abs(point.z - block.z) - block.halfZ);
      if (Math.hypot(dx, dz) < radius) {
        return true;
      }
    }

    return false;
  }
}

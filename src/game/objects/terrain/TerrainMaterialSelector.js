import { TileType } from "../../generator/map/MapGenerator.js";
import { SURFACE_MATERIALS } from "./TerrainBlockMaterialMaps.js";
import { PathSurfaceMaterials } from "../../rendering/terrain/PathSurfaceMaterials.js";
import { tileVariantIndex } from "../../rendering/terrain/TileVariantIndex.js";

export class TerrainMaterialSelector {
  /**
   *
   * @type {import("./GrassSurfaceMaterials.js").GrassSurfaceMaterials}
   */
  #grass;
  /**
   *
   * @type {import("./EarthSurfaceMaterials.js").EarthSurfaceMaterials}
   */
  #earth;
  /**
   *
   * @type {number}
   */
  #sideVariantCount;

  /**
   *
   * @param {import("./GrassSurfaceMaterials.js").GrassSurfaceMaterials} grass
   * @param {import("./EarthSurfaceMaterials.js").EarthSurfaceMaterials} earth
   * @param {number} sideVariantCount
   */
  constructor(grass, earth, sideVariantCount) {
    /**
     *
     * @type {import("./GrassSurfaceMaterials.js").GrassSurfaceMaterials}
     */
    this.#grass = grass;
    /**
     *
     * @type {import("./EarthSurfaceMaterials.js").EarthSurfaceMaterials}
     */
    this.#earth = earth;
    /**
     *
     * @type {number}
     */
    this.#sideVariantCount = sideVariantCount;
  }

  /**
   *
   * @param {string} type
   * @param {{top: string, sides: string, underlay: string}} topCube
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  cubeMaterials(type, topCube, col, row, level) {
    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      if (!topCube) {
        return {
          top: "earth",
          sides: this.#earth.sideForTile(col, row, level),
          underlay: "earth",
        };
      }
      return {
        top: this.#grass.topForTile(col, row, level),
        sides: this.#earth.topSideForTile(col, row, level),
        underlay: "earth",
      };
    }
    if (!topCube) {
      return {
        top: "earth",
        sides: this.#earth.sideForTile(col, row, level),
        underlay: "earth",
      };
    }
    return {
      top:
        type === TileType.GRASS
          ? this.#grass.topForTile(col, row, level)
          : ((type === TileType.PATH || type === TileType.ENTRY) ? PathSurfaceMaterials.topForTile(col, row, level) : SURFACE_MATERIALS[type]),
      sides:
        type === TileType.GRASS
          ? this.#earth.topSideForTile(col, row, level)
          : this.#earth.sideForTile(col, row, level),
      underlay: type === TileType.WATER ? "water" : "earth",
    };
  }

  /**
   *
   * @param {pc.Material} material
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  sideVariant(material, col, row, level) {
    if (material === "castleWall" || material === "castleTower") {
      return material;
    }
    const index = tileVariantIndex(col, row, level, 37, this.#sideVariantCount);
    return `${material}-${index}`;
  }
}

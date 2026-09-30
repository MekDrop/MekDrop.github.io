import { createEarthTextureVariants } from "./EarthTextureSelection.js";
import { TerrainBlockLayout } from "./TerrainBlockLayout.js";
import { SkyIslandScenery } from "../scenery/SkyIslandScenery.js";
import { MAP_TILE_TYPE } from "../../enum/MapTileType.js";
import { tileVariantIndex } from "../../rendering/terrain/TileVariantIndex.js";

/**
 * Publishes terrain geometry as authored block records and shared mesh commands.
 */
export class TerrainBlockDefinitions {
  /**
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  static populate(mapData) {
    mapData.earthTextureVariants ??= createEarthTextureVariants(mapData);
    if (mapData.renderCommands) {
      return;
    }
    const objects = [];
    const commands = [];
    /**
     * @param {string} kind
     * @param {number} col
     * @param {number} row
     * @param {number} level
     */
    const material = (kind, col, row, level) => `${kind}:${col}:${row}:${level}`;
    /**
     * @param {string} method
     * @param {Array} args
     */
    const record = (method, args) => {
      const top = args[0];
      const object = top.startsWith("grass:") ? "Grass" :
        top === "earth" || top === "islandRock" || top.startsWith("earthSide:") ? "Earth" : null;
      if (!object) {
        commands.push({ method, args });
        return;
      }
      const position = { x: args[2], y: args[3], z: args[4] };
      objects.push({
        id: `terrain-block-${objects.length}`,
        object,
        tile: { col: Math.round(position.x + (mapData.cols - 1) / 2), row: Math.round(position.z + (mapData.rows - 1) / 2) },
        position,
        geometry: { method, args },
        generated: true,
      });
    };
    new TerrainBlockLayout({
      mapData,
      instanceRenderer: {
        /**
         * @param {Array} args
         */
        addCubeMatrix: (...args) => record("addCubeMatrix", args),
        /**
         * @param {Array} args
         */
        addBoxMatrix: (...args) => record("addBoxMatrix", args),
      },
      bridgeRailingKit: {
        /**
         * @param {Array} args
         */
        addSpan: (...args) => commands.push({ method: "addSpan", args }),
        /**
         * @param {Array} args
         */
        addOverpass: (...args) => commands.push({ method: "addOverpass", args }),
      },
      /**
       * @param {number} type
       * @param {boolean} topCube
       * @param {number} col
       * @param {number} row
       * @param {number} level
       */
      cubeMaterials: (type, topCube, col, row, level) => {
        const turf = type === MAP_TILE_TYPE.GRASS || type === MAP_TILE_TYPE.CASTLE_WALL || type === MAP_TILE_TYPE.CASTLE_TOWER;
        return {
          top: !topCube ? "earth" : turf ? material("grass", col, row, level) : material("surface", col, row, level),
          sides: material(topCube && turf ? "turfSide" : "earthSide", col, row, level),
          underlay: topCube && type === MAP_TILE_TYPE.WATER ? "water" : "earth",
        };
      },
      /**
       * @param {Array<number>} args
       */
      earthSideMaterial: (...args) => material("earthSide", ...args),
      /**
       * @param {Array<number>} args
       */
      pathEarthSideMaterial: (...args) => material("overpassSide", ...args),
      /**
       * @param {string} name
       * @param {number} col
       * @param {number} row
       * @param {number} level
       */
      sideVariant: (name, col, row, level) => `${name}-${tileVariantIndex(col, row, level, 37, 6)}`,
    }).build(new SkyIslandScenery(mapData).createUndersideVoxels());
    mapData.objects = [...objects, ...(mapData.objects ?? [])];
    mapData.renderCommands = commands;
  }
}

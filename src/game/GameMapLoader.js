import { TerrainBlockDefinitions } from "./objects/terrain/TerrainBlockDefinitions.js";
import { BuriedTreasurePlacement } from "./objects/treasure/BuriedTreasurePlacement.js";
import { WalkingPaths } from "./navigation/WalkingPaths.js";

/**
 * Creates fresh playthrough state without changing the generated map.
 */
export class GameMapLoader {
  /**
   * @param {import("./objects/ObjectTypes.js").GameMapData} generatedMap
   * @param {() => number} random
   */
  static load(generatedMap, random = Math.random) {
    const mapData = structuredClone(generatedMap);
    WalkingPaths.rebuild(mapData);
    TerrainBlockDefinitions.populate(mapData);
    BuriedTreasurePlacement.populate(mapData, random);
    return mapData;
  }
}

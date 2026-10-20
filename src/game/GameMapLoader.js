import { CompiledMapCache } from "./cache/CompiledMapCache.js";
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
   * @param {{compiledMapCache?:boolean}} [options]
   */
  static load(generatedMap, random = Math.random, options = {}) {
    const mapData = structuredClone(generatedMap);
    WalkingPaths.rebuild(mapData);
    TerrainBlockDefinitions.populate(mapData);
    BuriedTreasurePlacement.populate(mapData, random);
    CompiledMapCache.prepare(mapData, options.compiledMapCache ?? true);

    return mapData;
  }
}

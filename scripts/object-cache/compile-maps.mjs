import { CastleGenerator } from "../../src/game/generator/castle/CastleGenerator.js";
import { TerrainBlockDefinitions } from "../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { MapObjectDefinitions } from "../../src/game/objects/MapObjectDefinitions.js";
import { CompiledMapCache } from "../../src/game/cache/CompiledMapCache.js";

/**
 * Bake map-owned transforms from the same terrain records used by map loading.
 * @param {import("../../src/game/GameContracts.js").GameMapData[]} maps
 */
export async function compileMaps(maps) {
  for (const source of maps) {
    if (!source.grid || !source.heightmap) {
      continue;
    }
    const map = structuredClone(source);
    MapObjectDefinitions.prepare(map);
    for (const definition of map.objects) {
      if (definition.object !== "Castle") {
        continue;
      }
      definition.buildPlan = await CastleGenerator.generate({
        basePlanId: definition.basePlanId,
        position: definition.position ?? definition.buildPlan?.input?.position,
        doors: definition.doors ?? definition.buildPlan?.input?.doors,
        seed: definition.seed ?? definition.buildPlan?.input?.seed,
      });
    }
    TerrainBlockDefinitions.populate(map);
    CompiledMapCache.prepare(map);
  }
}

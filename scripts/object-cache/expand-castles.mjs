import { LeisureRoomMapObjects } from "../../src/game/objects/castle/rooms/leisure/LeisureRoomMapObjects.js";
import { StairwellRoomMapObjects } from "../../src/game/objects/castle/rooms/stairwell/StairwellRoomMapObjects.js";
import { CastleGenerator } from "../../src/game/generator/castle/CastleGenerator.js";
import { CastleShelfMapObjects } from "../../src/game/objects/castle-props/shelf/CastleShelfMapObjects.js";
import { CastleStraightStairMapObjects } from "../../src/game/objects/castle/stairs/CastleStraightStairMapObjects.js";
import { LibraryRoomMapObjects } from "../../src/game/objects/castle/rooms/library/LibraryRoomMapObjects.js";
import { KitchenRoomMapObjects } from "../../src/game/objects/castle/rooms/kitchen/KitchenRoomMapObjects.js";
import { ObjectDataCache } from "../../src/game/cache/ObjectDataCache.js";

/**
 * Use the production planners to include saved castles' generated interiors.
 * @param {import("../../src/game/objects/ObjectTypes.js").MapObjectDefinition[]} definitions
 * @returns {Promise<import("../../src/game/objects/ObjectTypes.js").MapObjectDefinition[]>}
 */
export async function expandCastles(definitions) {
  const recipes = new Set();
  const generated = [];
  for (const castle of definitions) {
    if (castle.object !== "Castle") {
      continue;
    }
    const options = {
      basePlanId: castle.basePlanId,
      position: castle.position ?? castle.buildPlan?.input?.position,
      doors: castle.doors ?? castle.buildPlan?.input?.doors,
      seed: castle.seed ?? castle.buildPlan?.input?.seed,
      requestedStyle: castle.requestedStyle,
    };
    const key = ObjectDataCache.key({
      ...options,
      id: castle.id,
    });
    if (recipes.has(key)) {
      continue;
    }
    recipes.add(key);
    const buildPlan = await CastleGenerator.generate(options);
    const map = {
      cols: 64,
      rows: 64,
      objects: [{
        ...castle,
        buildPlan,
      }],
    };
    CastleShelfMapObjects.prepareMap(map);
    LibraryRoomMapObjects.prepareMap(map);
    KitchenRoomMapObjects.prepareMap(map);
    LeisureRoomMapObjects.prepareMap(map);
    StairwellRoomMapObjects.prepareMap(map);
    CastleStraightStairMapObjects.prepareMap(map);
    generated.push(...map.objects.slice(1));
  }
  console.log(`Expanded ${recipes.size} saved castle recipes.`);

  return generated;
}

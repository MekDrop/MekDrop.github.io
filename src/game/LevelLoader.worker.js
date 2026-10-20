import { CastleGenerator } from "./generator/castle/CastleGenerator.js";
import { RoomLayoutCache } from "./cache/RoomLayoutCache.js";
import { generateMap } from "./generator/map/MapGenerator.js";
import { GameMapLoader } from "./GameMapLoader.js";
import { ObjectDataCache } from "./cache/ObjectDataCache.js";

/**
 * @param {MessageEvent<import("./generator/map/MapGenerationTypes.js").MapGenerationOptions>} event
 */
globalThis.onmessage = async ({ data }) => {
  try {
    RoomLayoutCache.enabled = data.roomLayoutCache ?? true;
    CastleGenerator.cacheEnabled = data.castlePlanCache ?? true;
    await ObjectDataCache.preload();
    const map = GameMapLoader.load(await generateMap(data), Math.random, {
      compiledMapCache: data.compiledMapCache,
    });
    globalThis.postMessage({ map });
  } catch (error) {
    globalThis.postMessage({ error });
  }
};

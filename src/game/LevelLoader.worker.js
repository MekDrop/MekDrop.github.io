import { generateMap } from "./generator/map/MapGenerator.js";
import { GameMapLoader } from "./GameMapLoader.js";
import { ObjectDataCache } from "./cache/ObjectDataCache.js";

/**
 * @param {MessageEvent<import("./generator/map/MapGenerationTypes.js").MapGenerationOptions>} event
 */
globalThis.onmessage = async ({ data }) => {
  try {
    await ObjectDataCache.preload();
    const map = GameMapLoader.load(await generateMap(data));
    globalThis.postMessage({ map });
  } catch (error) {
    globalThis.postMessage({ error });
  }
};

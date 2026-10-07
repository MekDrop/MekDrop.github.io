import { generateMap } from "./generator/map/MapGenerator.js";
import { GameMapLoader } from "./GameMapLoader.js";

/**
 * @param {MessageEvent<import("./generator/map/MapGenerationTypes.js").MapGenerationOptions>} event
 */
globalThis.onmessage = async ({ data }) => {
  try {
    const map = GameMapLoader.load(await generateMap(data));
    globalThis.postMessage({ map });
  } catch (error) {
    globalThis.postMessage({ error });
  }
};

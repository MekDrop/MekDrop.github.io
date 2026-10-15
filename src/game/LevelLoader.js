import { generateMap } from "./generator/map/MapGenerator.js";
import { GameMapLoader } from "./GameMapLoader.js";

/**
 * Prepares generated levels away from the rendering thread when available.
 */
export class LevelLoader {
  /**
   * @param {import("./generator/map/MapGenerationTypes.js").MapGenerationOptions} options
   */
  static async load(options) {
    if (typeof Worker === "undefined") {
      return this.#loadLocally(options);
    }
    let worker;
    try {
      worker = new Worker(new URL("./LevelLoader.worker.js", import.meta.url), {
        type: "module",
      });
    } catch {
      return this.#loadLocally(options);
    }
    let map;
    try {
      map = await new Promise(/**
       * @param {(map: import("./GameContracts.js").GameMapData) => void} resolve
       * @param {(error: Error) => void} reject
       */
        (resolve, reject) => {
        /**
         * @param {MessageEvent<{map?: import("./GameContracts.js").GameMapData, error?: Error}>} event
         */
          worker.onmessage = ({ data }) => {
            if (data.error) {
              reject(data.error);
            } else {
              resolve(data.map);
            }
          };
          /**
         * @param {ErrorEvent} event
         */
          worker.onerror = (event) => {
            event.preventDefault();
            resolve(null);
          };
          worker.onmessageerror = () => resolve(null);
          try {
            worker.postMessage(options);
          } catch {
            resolve(null);
          }
        });
    } finally {
      worker.terminate();
    }

    return map ?? this.#loadLocally(options);
  }

  /**
   * @param {import("./generator/map/MapGenerationTypes.js").MapGenerationOptions} options
   */
  static async #loadLocally(options) {
    return GameMapLoader.load(await generateMap(options));
  }
}

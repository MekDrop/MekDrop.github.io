import { CastleGenerator } from "./CastleGenerator.js";

/**
 * Generate replacement plans off the rendering thread when possible.
 */
export class CastlePlanLoader {
  /**
   * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} definition
   * @param {number|string} seed
   * @returns {Promise<import("../../GameContracts.js").CastleBuildPlan>}
   */
  static async generate(definition, seed) {
    // Only generator inputs cross the worker boundary; definitions also contain
    // the old plan, runtime references and fields unrelated to generation.
    const options = {
      position: definition.position,
      doors: definition.doors,
      basePlanId: definition.basePlanId,
      requestedStyle: definition.requestedStyle,
      seed,
    };
    if (typeof Worker === "undefined") {
      return CastleGenerator.generate(options);
    }
    let worker;
    try {
      worker = new Worker(new URL("./CastlePlanWorker.js", import.meta.url), { type: "module" });
    } catch {
      return CastleGenerator.generate(options);
    }
    try {
      const result = await new Promise(/**
       * @param {(value: {plan?: import("../../GameContracts.js").CastleBuildPlan, error?: Error}|null) => void} resolve
       */
        (resolve) => {
        /**
         * @param {MessageEvent} event
         */
          worker.onmessage = ({ data }) => resolve(data);
          /**
           * @param {ErrorEvent} event
           */
          worker.onerror = (event) => {
            event.preventDefault();
            resolve(null);
          };
          worker.onmessageerror = CastlePlanLoader.#onMessageError.bind(null, resolve);
          try {
            worker.postMessage(options);
          } catch {
            resolve(null);
          }
        });
      if (result?.error) {
        // Recreate the original named error locally: structured cloning can
        // erase custom Error subclasses across the worker boundary.
        return CastleGenerator.generate(options);
      }

      return result?.plan ?? CastleGenerator.generate(options);
    } finally {
      worker.terminate();
    }
  }

  /**
   * @param {(value: null) => void} resolve
   */
  static #onMessageError(resolve) {
    resolve(null);
  }
}

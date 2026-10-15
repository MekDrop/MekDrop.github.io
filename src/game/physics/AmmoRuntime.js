import createAmmo from "src/assets/game/wasm/ammo/ammo.wasm.js";
import ammoWasmUrl from "src/assets/game/wasm/ammo/ammo.wasm.wasm?url";
import { PhysicsModuleLoadError } from "../errors/assets/PhysicsModuleLoadError.js";

/**
 * Initialize once before creating entities or either Ammo physics world.
 */
export class AmmoRuntime {
  /**
   * @type {Promise<void>|null}
   */
  static #initialization = null;

  /**
   * @returns {Promise<void>}
   */
  static initialize() {
    if (this.#initialization) {
      return this.#initialization;
    }
    if (globalThis.Ammo?.btVector3) {
      return Promise.resolve();
    }
    this.#initialization ??= new Promise(/**
     * @param {() => void} resolve
     * @param {(error: PhysicsModuleLoadError) => void} reject
     */
      (resolve, reject) => {
        createAmmo.call(globalThis, {
          locateFile: () => ammoWasmUrl,
          /**
         * @param {string} detail
         */
          onAbort: (detail) => reject(new PhysicsModuleLoadError(detail)),
        }).then(/**
       * @param {typeof globalThis.Ammo} instance
       */
          (instance) => {
            globalThis.Ammo = instance;
            resolve();
          });
      });
    return this.#initialization;
  }
}

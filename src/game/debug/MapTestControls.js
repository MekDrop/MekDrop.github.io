/**
 * @typedef {object} MapTestButton
 * @property {string} label
 * @property {string} script
 */

/**
 * Runs map-authored button scripts with the same live registry as TriggerArea.
 */
export class MapTestControls {
  /**
   * @type {() => import("../rendering/scene/SceneObjectRegistry.js").SceneObjectRegistry}
   */
  #getObjects;
  /**
   * @type {(viewport: {zoom: number, rotation: number, panX: number, panZ: number, manuallyMoved?: boolean}) => void}
   */
  #setViewport;
  /**
   * @type {(enabled: boolean) => void}
   */
  #setFirstPerson;
  /**
   * @type {() => import("../GameContracts.js").GameMapData}
   */
  #getMap;
  /**
   * @type {((error: Error) => void)|null}
   */
  #onRuntimeError;
  /**
   * @type {WeakMap<MapTestButton, Function>}
   */
  #scripts = new WeakMap();

  /**
   * @param {{getObjects: () => import("../rendering/scene/SceneObjectRegistry.js").SceneObjectRegistry, setFirstPerson?: (enabled: boolean) => void, setViewport: (viewport: {zoom: number, rotation: number, panX: number, panZ: number, manuallyMoved?: boolean}) => void, getMap: () => import("../GameContracts.js").GameMapData, onRuntimeError?: (error: Error) => void}} options
   */
  constructor({ getObjects, setViewport, getMap, setFirstPerson = () => {}, onRuntimeError = null }) {
    this.#getObjects = getObjects;
    this.#setViewport = setViewport;
    this.#setFirstPerson = setFirstPerson;
    this.#getMap = getMap;
    this.#onRuntimeError = onRuntimeError;
  }

  /**
   * @param {MapTestButton} button
   * @returns {boolean}
   */
  execute(button) {
    try {
      let script = this.#scripts.get(button);
      if (!script) {
        script = Function("active", "objects", "trigger", "button", "map", "camera", `"use strict";\n${button.script}`);
        this.#scripts.set(button, script);
      }
      script(true, this.#getObjects(), button, button, this.#getMap(), {
        /**
         * @param {{zoom: number, rotation: number, panX: number, panZ: number}} viewport
         */
        setViewport: (viewport) => this.#setViewport({
          ...viewport,
          manuallyMoved: true,
        }),
        /**
         * @param {boolean} enabled
         */
        setFirstPerson: (enabled) => this.#setFirstPerson(enabled),
      });
      return true;
    } catch (error) {
      if (!this.#onRuntimeError) { throw error; }
      this.#onRuntimeError(error);
      return false;
    }
  }

  /**
   * @param {string} targetId
   * @returns {string}
   */
  status(targetId) {
    const target = [...this.#getObjects()].find(
      /**
       * @param {import("../objects/ObjectTypes.js").MapObjectLike} object
       */
      (object) => object.definition?.id === targetId,
    );
    return target?.testStatus ?? "Target unavailable";
  }
}

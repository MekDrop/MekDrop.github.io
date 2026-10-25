/**
 * Development boundaries publish updates after installing the new constructors.
 * Each mounted game subscribes independently and decides whether it is affected.
 */
export class GameHotReload {
  /**
   * @type {Set<(update: GameHotUpdate) => void>}
   */
  static #listeners = new Set();

  /**
   * @param {(update: GameHotUpdate) => void} listener
   * @returns {() => void}
   */
  static subscribe(listener) {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  /**
   * @param {GameHotUpdate} update
   */
  static publish(update) {
    for (const listener of this.#listeners) {
      listener(update);
    }
  }
}

/**
 * @typedef {object} GameHotUpdate
 * @property {string[]} [objects]
 * @property {Array<typeof import("../ui/GamePanelHud.js").GamePanelHud>} [huds]
 * @property {string[]} [maps]
 */

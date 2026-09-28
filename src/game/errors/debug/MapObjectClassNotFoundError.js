export class MapObjectClassNotFoundError extends Error {
  /**
   *
   * @param {{object: import("src/game/GameContracts.js").GameObjectContract}} options
   * @param {import("src/game/GameContracts.js").GameObjectContract} options.object
   */
  constructor({ object }) {
    super(`No map object class is registered for "${object}".`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}

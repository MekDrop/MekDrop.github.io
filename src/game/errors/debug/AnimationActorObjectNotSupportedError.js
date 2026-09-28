export class AnimationActorObjectNotSupportedError extends Error {
  /**
   *
   * @param {{object: import("src/game/GameContracts.js").GameObjectContract}} options
   * @param {import("src/game/GameContracts.js").GameObjectContract} options.object
   */
  constructor({ object }) {
    super(`Animation actor object "${object}" is not supported.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}

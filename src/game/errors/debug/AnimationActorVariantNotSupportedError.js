export class AnimationActorVariantNotSupportedError extends Error {
  /**
   *
   * @param {{object: import("src/game/GameContracts.js").GameObjectContract, variant: string}} options
   * @param {import("src/game/GameContracts.js").GameObjectContract} options.object
   * @param {string} options.variant
   */
  constructor({ object, variant }) {
    super(
      `Animation actor variant "${variant}" is not supported for "${object}".`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}

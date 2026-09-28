/**
 * Connects a royal's current wish to an available servant.
 */
export class RoyalWishFulfillment {
  /**
   *
    * @type {import("./RoyalTerraceActivityBehavior.js").RoyalTerraceActivityBehavior}
   */
  #royal;
  /**
   *
    * @type {import("./TerraceServantBehavior.js").TerraceServantBehavior|null}
   */
  #servant;

  /**
   *
   * @param {import("./RoyalTerraceActivityBehavior.js").RoyalTerraceActivityBehavior} royal
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior|null} servant
   */
  constructor(royal, servant = null) {
    this.#royal = royal;
    this.#servant = servant;
  }

  /**
   *
   * @param {boolean} triggered
   */
  update(triggered) {
    this.#royal.requested = triggered;
    const wish = this.#royal.wish;
    if (wish && this.#servant) {
      this.#servant.fulfill(wish);
      this.#royal.fulfillWish(this.#servant.fulfilledService);
      return;
    }
    if (!triggered && this.#royal.onThrone) {
      this.#servant?.release();
    }
  }
}

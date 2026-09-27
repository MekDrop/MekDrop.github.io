/**
 * Connects a royal's current wish to an available servant.
 */
export class RoyalWishFulfillment {
  #royal;
  #servant;

  constructor(royal, servant = null) {
    this.#royal = royal;
    this.#servant = servant;
  }

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

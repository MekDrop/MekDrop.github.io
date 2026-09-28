export class PickupSequenceItemNotFoundError extends Error {
  /**
   *
   * @param {{actorId: string, itemId: string}} options
   * @param {string} options.actorId
   * @param {string} options.itemId
   */
  constructor({ actorId, itemId }) {
    super(`Pickup actor "${actorId}" references missing item "${itemId}".`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}

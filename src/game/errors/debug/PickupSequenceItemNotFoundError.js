export class PickupSequenceItemNotFoundError extends Error {
  constructor({ actorId, itemId }) {
    super(`Pickup actor "${actorId}" references missing item "${itemId}".`);
    this.name = this.constructor.name;
  }
}

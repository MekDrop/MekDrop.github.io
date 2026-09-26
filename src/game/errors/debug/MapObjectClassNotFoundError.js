export class MapObjectClassNotFoundError extends Error {
  constructor({ object }) {
    super(`No map object class is registered for "${object}".`);
    this.name = this.constructor.name;
  }
}

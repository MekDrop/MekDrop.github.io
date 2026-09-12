export class StoredMapNotFoundError extends Error {
  constructor({ mapName }) {
    super(`Stored map "${mapName}" was not found.`);
    this.name = this.constructor.name;
  }
}

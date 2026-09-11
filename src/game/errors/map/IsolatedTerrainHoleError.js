export class IsolatedTerrainHoleError extends Error {
  constructor({ col, row }) {
    super(
      `Map validation failed: isolated one-tile terrain hole at (${col}, ${row}).`,
    );
    this.name = this.constructor.name;
  }
}

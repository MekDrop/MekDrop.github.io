export class BridgeGroundHeightMismatchError extends Error {
  constructor({ col, row, expectedHeight, actualHeight }) {
    super(
      `Map validation failed: bridge tile at (${col}, ${row}) requires grass ground at height ${expectedHeight}, not ${actualHeight}.`,
    );
    this.name = this.constructor.name;
  }
}

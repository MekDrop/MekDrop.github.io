/**
 * Owns authored connector topology. Shared island motion consumes its map view.
 */
export class IslandConnector {
  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, definition }) {
    this.definition = definition;
    this.entity = new pc.Entity(definition.id);
  }

  destroy() {
    this.entity.destroy();
  }
}

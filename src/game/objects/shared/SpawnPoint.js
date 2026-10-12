/**
 * Authored player spawn; the playable hero reads its position through the map.
 */
export class SpawnPoint {
  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, definition }) {
    this.definition = definition;
    this.entity = new pc.Entity(definition.id);
    const { x, y, z } = definition.position;
    this.entity.setPosition(x, y, z);
  }

  destroy() {
    this.entity.destroy();
  }
}

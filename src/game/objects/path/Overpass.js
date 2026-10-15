import { OverpassStairs } from "./OverpassStairs.js";
import { PathOverpassCollider } from "../../collision/PathOverpassCollider.js";

/**
 * Owns overpass stairs and its collision provider. Tile surfaces own the deck.
 */
export class Overpass {
  /**
   * @type {Array<import("playcanvas").VertexBuffer>}
   */
  #buffers;
  /**
   * @type {PathOverpassCollider}
   */
  #collider;

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [OverpassStairs.modelUrl]; }

  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, modelLibrary, definition, runtime }) {
    this.definition = definition;
    this.entity = new pc.Entity(definition.id);
    const { cols, rows } = runtime.mapData;
    this.#buffers = new OverpassStairs({
      pc,
      modelLibrary,
      cols,
      rows,
      overpass: definition.layout,
      materials: runtime.materials,
      root: this.entity,
    }).build();
    this.#collider = new PathOverpassCollider({
      overpass: definition.layout,
      cols,
      rows,
    });
    runtime.collisionWorld.add(this.#collider);
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {number} radius
   */
  isBelowDeckAt(x, z, elevation, radius) {
    return this.#collider.isBelowDeckAt(x, z, elevation, radius);
  }

  destroy() {
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    this.entity.destroy();
  }
}

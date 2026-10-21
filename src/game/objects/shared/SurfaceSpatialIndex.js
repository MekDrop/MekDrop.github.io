/**
 * Finds stationary geometry near an X/Z query without scanning the map.
 * @template T
 */
export class SurfaceSpatialIndex {
  /**
   * @type {Map<string, Set<T>>}
   */
  #cells = new Map();

  /**
   * @param {T} item
   * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} bounds
   */
  add(item, bounds) {
    for (let x = Math.floor(bounds.minX / 4); x <= Math.floor(bounds.maxX / 4); x++) {
      for (let z = Math.floor(bounds.minZ / 4); z <= Math.floor(bounds.maxZ / 4); z++) {
        const key = `${x}:${z}`;
        let cell = this.#cells.get(key);
        if (!cell) {
          cell = new Set();
          this.#cells.set(key, cell);
        }
        cell.add(item);
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @returns {Set<T>}
   */
  query(x, z, radius = 0) {
    const items = new Set();
    for (let col = Math.floor((x - radius) / 4); col <= Math.floor((x + radius) / 4); col++) {
      for (let row = Math.floor((z - radius) / 4); row <= Math.floor((z + radius) / 4); row++) {
        const cell = this.#cells.get(`${col}:${row}`);
        if (cell) {
          for (const item of cell) {
            items.add(item);
          }
        }
      }
    }

    return items;
  }
}

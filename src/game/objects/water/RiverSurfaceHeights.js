export class RiverSurfaceHeights {
  /**
   *
    * @type {Map}
   */
  #cells;

  /**
   *
   * @param {number} cells
   */
  constructor(cells) {
    this.#cells = new Map(cells.map(/**
     *
     * @param {number} cell
     */
    (cell) => [`${cell.col},${cell.row}`, cell]));
  }

  /**
   *
   * @param {number} cell
   */
  cornersFor(cell) {
    return [[0, 0], [1, 0], [0, 1], [1, 1]].map(/**
     *
     * @param {Array<number>} options
     * @param {number} options."0"
     * @param {number} options."1"
     */
    ([dx, dz]) => {
      const heights = [];
      for (const col of [cell.col + dx - 1, cell.col + dx]) {
        for (const row of [cell.row + dz - 1, cell.row + dz]) {
          const neighbor = this.#cells.get(`${col},${row}`);
          // Bridge clearances can make a 0.02-cube step without a cascade.
          // Average those shared corners; real waterfalls keep separate levels.
          if (neighbor && Math.abs(neighbor.elevation - cell.elevation) <= 0.04) {
            heights.push(neighbor.elevation);
          }
        }
      }
      return heights.reduce(/**
       *
       * @param {number} sum
       * @param {number} elevation
       */
      (sum, elevation) => sum + elevation, 0) / heights.length + 0.012;
    });
  }
}

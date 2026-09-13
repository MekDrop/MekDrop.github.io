export class RiverSurfaceHeights {
  #cells;

  constructor(cells) {
    this.#cells = new Map(cells.map((cell) => [`${cell.col},${cell.row}`, cell]));
  }

  cornersFor(cell) {
    return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dz]) => {
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
      return heights.reduce((sum, elevation) => sum + elevation, 0) / heights.length + 0.012;
    });
  }
}

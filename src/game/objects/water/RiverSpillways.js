/**
 * Finds all exposed downhill joins in a connected river family.
 */
export class RiverSpillways {
  /**
   * @param {import('../../generator/map/MapGenerationTypes.js').RiverData} river
   * @param {import('../../generator/map/MapGenerationTypes.js').RiverData[]} family
   */
  static cascadesFor(river, family) {
    const cells = new Map();
    for (const channel of family) {
      for (const cell of channel.cells) {
        cells.set(`${cell.col},${cell.row}`, cell);
      }
    }
    const owned = new Set();
    for (const cell of river.cells.slice(river.branchStart ?? 0)) {
      owned.add(`${cell.col},${cell.row}`);
    }
    const cascades = [];
    const recorded = new Set();
    for (const channel of family) {
      for (const cascade of channel.cascades) {
        const from = `${cascade.from.col},${cascade.from.row}`;
        const key = `${from}|${cascade.direction}`;
        if (owned.has(from) && !recorded.has(key)) {
          cascades.push(cascade);
          recorded.add(key);
        }
      }
    }
    for (let index = Math.max(1, river.branchStart ?? 1); index < river.cells.length; index++) {
      const cell = river.cells[index];
      for (const [direction, dc, dr] of [
        ['NORTH', 0, -1], ['EAST', 1, 0], ['SOUTH', 0, 1], ['WEST', -1, 0],
      ]) {
        const neighbor = cells.get(`${cell.col + dc},${cell.row + dr}`);
        const key = `${cell.col},${cell.row}|${direction}`;
        if (!neighbor || cell.elevation - neighbor.elevation <= 0.04 || recorded.has(key)) {
          continue;
        }
        recorded.add(key);
        cascades.push({
          from: {
            col: cell.col,
            row: cell.row,
          },
          to: {
            col: neighbor.col,
            row: neighbor.row,
          },
          direction,
          topElevation: cell.elevation,
          bottomElevation: neighbor.elevation,
        });
      }
    }

    return cascades;
  }
}

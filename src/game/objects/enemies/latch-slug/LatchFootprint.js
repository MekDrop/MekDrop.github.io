/**
 * Conservative door-plane coverage of the actual gel triangles, in 2 cm cells.
 * Empty space inside a bounding box does not connect separate drops.
 */
export class LatchFootprint {
  /**
   * @param {number[]} positions Projected XY vertex pairs.
   * @param {ArrayLike<number>} indices Triangle indices.
   */
  constructor(positions, indices) {
    this.cells = new Set();
    const step = 0.02;
    for (let i = 0; i < indices.length; i += 3) {
      const vertices = [indices[i], indices[i + 1], indices[i + 2]];
      const ys = vertices.map(/**
       *
       * @param {number} index
       */
        index => positions[index * 2 + 1]);
      const bottom = Math.floor(Math.min(...ys) / step);
      const top = Math.floor(Math.max(...ys) / step);
      for (let row = bottom; row <= top; row++) {
        const low = row * step, high = low + step;
        const xs = [];
        for (let edge = 0; edge < 3; edge++) {
          const a = vertices[edge] * 2, b = vertices[(edge + 1) % 3] * 2;
          const x = positions[a], y = positions[a + 1];
          const nextX = positions[b], nextY = positions[b + 1];
          if (y >= low && y <= high) {
            xs.push(x);
          }
          for (const level of [low, high]) {
            if (nextY !== y && level >= Math.min(y, nextY) && level <= Math.max(y, nextY)) {
              xs.push(x + (nextX - x) * (level - y) / (nextY - y));
            }
          }
        }
        if (!xs.length) {
          continue;
        }
        const left = Math.floor(Math.min(...xs) / step), right = Math.floor(Math.max(...xs) / step);
        for (let column = left; column <= right; column++) {
          this.cells.add(`${column},${row}`);
        }
      }
    }
  }

  /**
   * @param {LatchFootprint} other
   * @returns {boolean}
   */
  touches(other) {
    for (const cell of this.cells) {
      if (other.cells.has(cell)) {
        return true;
      }
    }

    return false;
  }
}

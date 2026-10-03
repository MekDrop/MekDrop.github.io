/**
 * Subtract terrain excavation boxes from a surface polygon without changing its plane.
 * @param {number[][]} polygon
 * @param {Array<{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}>} cuts
 * @returns {number[][][]}
 */
export function subtractTerrainCutouts(polygon, cuts) {
  let pieces = [polygon];
  for (const cut of cuts) {
    const planes = [[0, cut.minX, true], [0, cut.maxX, false],
      [1, cut.minY, true], [1, cut.maxY, false],
      [2, cut.minZ, true], [2, cut.maxZ, false]];
    const retained = [];
    for (const piece of pieces) {
      let inside = piece;
      for (const [axis, value, greater] of planes) {
        const outside = clipHalfSpace(inside, axis, value, !greater);
        if (outside.length >= 3) retained.push(outside);
        inside = clipHalfSpace(inside, axis, value, greater);
        if (inside.length < 3) break;
      }
    }
    pieces = retained;
  }
  return pieces;
}

/**
 * @param {number[][]} polygon
 * @param {number} axis
 * @param {number} value
 * @param {boolean} greater
 * @returns {number[][]}
 */
function clipHalfSpace(polygon, axis, value, greater) {
  const result = [];
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length];
    const aInside = greater ? a[axis] >= value : a[axis] <= value;
    const bInside = greater ? b[axis] >= value : b[axis] <= value;
    if (aInside) result.push(a);
    if (aInside !== bInside) {
      const progress = (value - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map(
        /**
         * @param {number} coordinate
         * @param {number} dimension
         */
        (coordinate, dimension) => coordinate + (b[dimension] - coordinate) * progress));
    }
  }
  return result;
}

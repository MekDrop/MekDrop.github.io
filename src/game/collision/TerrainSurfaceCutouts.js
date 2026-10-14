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
      // Boundary contact has no excavated volume. Keeping it out of the
      // clipping pass also prevents coplanar faces being retained twice.
      if ([0, 1, 2].some(/**
       * @param {number} axis
       */
      (axis) => {
        const values = piece.map(/**
         * @param {number[]} point
         */
        (point) => point[axis]);
        const minimum = [cut.minX, cut.minY, cut.minZ][axis];
        const maximum = [cut.maxX, cut.maxY, cut.maxZ][axis];
        return Math.max(...values) <= minimum + 1e-8 || Math.min(...values) >= maximum - 1e-8;
      })) {
        retained.push(piece);
        continue;
      }
      let inside = piece;
      for (const [axis, value, greater] of planes) {
        const outside = clipHalfSpace(inside, axis, value, !greater);
        if (hasSurfaceArea(outside)) retained.push(outside);
        inside = clipHalfSpace(inside, axis, value, greater);
        if (!hasSurfaceArea(inside)) break;
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

/**
 * Reject collinear fragments before subsequent cuts can multiply them.
 * @param {number[][]} polygon
 * @returns {boolean}
 */
function hasSurfaceArea(polygon) {
  if (polygon.length < 3) { return false; }
  const normal = [0, 0, 0];
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length];
    normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
    normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
    normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return Math.hypot(...normal) > 1e-8;
}

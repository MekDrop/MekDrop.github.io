/**
 * @typedef {{dc: number, dr: number, pathIdx: number, surfacePitch?: number}} RouteArrow
 * @typedef {{col: number, row: number, elevation: number, arrows: RouteArrow[]}} RouteMarker
 */
/**
 * Keeps the route marker grouping and projection independent of rendering.
 */
export class PathArrowTextureLayout {
  /**
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   * @returns {Array<{col: number, row: number, elevation: number, dx: number, dz: number, pitch: number, palette: number}>}
   */
  static markers(mapData) {
    const remaining = new Set(
      [...(mapData.arrowData ?? new Map()).entries()].map(/**
       *
       * @param {[string, RouteArrow[]]} options
       * @param {string} options."0"
       * @param {RouteArrow[]} options."1"
       */
      ([key, arrows]) => {
        const [col, row, elevation] = key.split(",").map(Number);
        return { col, row, elevation, arrows };
      }),
    );
    const result = [];
    while (remaining.size) {
      const first = remaining.values().next().value;
      remaining.delete(first);
      const group = [first];
      for (let index = 0; index < group.length; index += 1) {
        const current = group[index];
        for (const candidate of remaining) {
          if (
            Math.hypot(candidate.col - current.col, candidate.row - current.row) > 0.76 ||
            (Number.isFinite(candidate.elevation) && Number.isFinite(current.elevation) &&
              Math.abs(candidate.elevation - current.elevation) > 0.1)
          ) {
            continue;
          }
          remaining.delete(candidate);
          group.push(candidate);
        }
      }
      const arrows = group.flatMap(/**
       *
       * @param {RouteMarker} marker
       */
      (marker) => marker.arrows);
      const directions = arrows.filter(/**
       *
       * @param {RouteArrow} arrow
       */
      (arrow) => Math.hypot(arrow.dc, arrow.dr) > 0)
        .map(/**
         *
         * @param {RouteArrow} arrow
         */
        (arrow) => {
          const length = Math.hypot(arrow.dc, arrow.dr);
          return { dx: arrow.dc / length, dz: arrow.dr / length };
        });
      if (!directions.length || !mapData.entries.length) {
        continue;
      }
      let dx = directions.reduce(/**
       *
       * @param {number} sum
       * @param {{dx: number, dz: number}} direction
       */
      (sum, direction) => sum + direction.dx, 0);
      let dz = directions.reduce(/**
       *
       * @param {number} sum
       * @param {{dx: number, dz: number}} direction
       */
      (sum, direction) => sum + direction.dz, 0);
      const length = Math.hypot(dx, dz);
      if (length < 0.001) {
        ({ dx, dz } = directions[0]);
      } else {
        dx /= length;
        dz /= length;
      }
      result.push({
        col: group.reduce(/**
         *
         * @param {number} sum
         * @param {RouteMarker} marker
         */
        (sum, marker) => sum + marker.col, 0) / group.length,
        row: group.reduce(/**
         *
         * @param {number} sum
         * @param {RouteMarker} marker
         */
        (sum, marker) => sum + marker.row, 0) / group.length,
        elevation: Math.max(...group.map(/**
         *
         * @param {RouteMarker} marker
         */
        (marker) => Number.isFinite(marker.elevation)
          ? marker.elevation : mapData.heightmap[Math.round(marker.row)]?.[Math.round(marker.col)] ?? 0)),
        dx,
        dz,
        pitch: arrows.reduce(/**
         *
         * @param {number} sum
         * @param {RouteArrow} arrow
         */
        (sum, arrow) => sum + (arrow.surfacePitch ?? 0), 0) / arrows.length * Math.PI / 180,
        palette: arrows.reduce(/**
         *
         * @param {number} mask
         * @param {RouteArrow} arrow
         */
        (mask, arrow) => mask | (1 << (arrow.pathIdx % mapData.entries.length)), 0),
      });
    }
    return result;
  }
}

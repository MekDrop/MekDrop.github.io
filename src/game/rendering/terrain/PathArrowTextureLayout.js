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
      [...(mapData.arrowData ?? new Map()).entries()].map(
        PathArrowTextureLayout.#map,
      ),
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
      const arrows = group.flatMap(PathArrowTextureLayout.#flatMapMarker);
      const directions = arrows
        .filter(PathArrowTextureLayout.#filterArrow)
        .map(PathArrowTextureLayout.#mapArrow);
      if (!directions.length || !mapData.entries.length) {
        continue;
      }
      let dx = directions.reduce(PathArrowTextureLayout.#reduceSum, 0);
      let dz = directions.reduce(PathArrowTextureLayout.#reduceSum2, 0);
      const length = Math.hypot(dx, dz);
      if (length < 0.001) {
        ({ dx, dz } = directions[0]);
      } else {
        dx /= length;
        dz /= length;
      }
      result.push({
        col: group.reduce(PathArrowTextureLayout.#reduceSum3, 0) / group.length,
        row: group.reduce(PathArrowTextureLayout.#reduceSum4, 0) / group.length,
        elevation: Math.max(...group.map(/**
         *
         * @param {RouteMarker} marker
         */
          (marker) => Number.isFinite(marker.elevation)
            ? marker.elevation : mapData.heightmap[Math.round(marker.row)]?.[Math.round(marker.col)] ?? 0)),
        dx,
        dz,
        pitch:
          ((arrows.reduce(PathArrowTextureLayout.#reduceSum5, 0) /
            arrows.length) *
            Math.PI) /
          180,
        palette: arrows.reduce(/**
         *
         * @param {number} mask
         * @param {RouteArrow} arrow
         */
          (mask, arrow) => mask | (1 << (arrow.pathIdx % mapData.entries.length)), 0),
      });
    }
    if (mapData.overpassData?.stairApproach) {
      for (const marker of result) {
        /**
         * @param {{col: number, row: number}} cell
         */
        const containsSlopeMarker = (cell) => Math.abs(cell.col - marker.col) <= 0.5 &&
          Math.abs(cell.row - marker.row) <= 0.5;
        if (!marker.pitch || !mapData.overpassData.slopeCells.some(containsSlopeMarker)) {
          continue;
        }
        // Keep the head's broad base off a riser. Only the narrow shaft crosses
        // the step, avoiding a stretched rectangle of white outline paint.
        const offset = 0.125;
        marker.col += marker.dx * offset;
        marker.row += marker.dz * offset;
        marker.elevation += Math.tan(marker.pitch) * offset;
      }
    }
    return result;
  }

  /**
   *
   * @param {[string, RouteArrow[]]} options
   * @param {string} options."0"
   * @param {RouteArrow[]} options."1"
   */
  static #map([key, arrows]) {
    const [col, row, elevation] = key.split(",").map(Number);

    return {
      col,
      row,
      elevation,
      arrows,
    };
  }

  /**
   *
   * @param {RouteMarker} marker
   */
  static #flatMapMarker(marker) {
    return marker.arrows;
  }

  /**
   *
   * @param {RouteArrow} arrow
   */
  static #filterArrow(arrow) {
    return Math.hypot(arrow.dc, arrow.dr) > 0;
  }

  /**
   *
   * @param {RouteArrow} arrow
   */
  static #mapArrow(arrow) {
    const length = Math.hypot(arrow.dc, arrow.dr);

    return {
      dx: arrow.dc / length,
      dz: arrow.dr / length,
    };
  }

  /**
   *
   * @param {number} sum
   * @param {{dx: number, dz: number}} direction
   */
  static #reduceSum(sum, direction) {
    return sum + direction.dx;
  }

  /**
   *
   * @param {number} sum
   * @param {{dx: number, dz: number}} direction
   */
  static #reduceSum2(sum, direction) {
    return sum + direction.dz;
  }

  /**
   *
   * @param {number} sum
   * @param {RouteMarker} marker
   */
  static #reduceSum3(sum, marker) {
    return sum + marker.col;
  }

  /**
   *
   * @param {number} sum
   * @param {RouteMarker} marker
   */
  static #reduceSum4(sum, marker) {
    return sum + marker.row;
  }

  /**
   *
   * @param {number} sum
   * @param {RouteArrow} arrow
   */
  static #reduceSum5(sum, arrow) {
    return sum + (arrow.surfacePitch ?? 0);
  }
}

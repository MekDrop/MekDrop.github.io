import { FOUNDATION_HEIGHT, PATH_HEIGHT } from "./mapGenerationConfig.js";
import { MAP_TILE_TYPE } from "../../enum/MapTileType.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";

/**
 * Raises the final approach before its flat two-by-two doorway landing.
 * Uses the same two half-metre-rise slope tiles as bridge approaches.
 */
export class CastleApproachRamp {
  /**
   * @param {import("./MapGenerationTypes.js").MapLayout} layout
   * @returns {Array<{col:number,row:number,height:number,shape:string,slope?:{lowHeight:number,highHeight:number,riseDirection:string}}>}
   */
  static cells(layout) {
    if (!layout?.castleApproachRamp || !layout.castleApproach?.length) {
      return [];
    }
    const points = layout.castleApproach;
    const corner = points.at(-2);
    const previous = points.at(-3);
    const end = points.at(-1);
    const sign = Math.sign(corner.row2 - previous.row2);
    const col = Math.floor(corner.col2 / 2);
    const row = Math.floor(corner.row2 / 2);
    const cells = [];
    // The turn remains flat. Raise the two preceding stations, in both lanes.
    for (let step = 0; step < 2; step++) {
      const lowHeight = PATH_HEIGHT + step * (FOUNDATION_HEIGHT - PATH_HEIGHT) / 2;
      const highHeight = PATH_HEIGHT + (step + 1) * (FOUNDATION_HEIGHT - PATH_HEIGHT) / 2;
      const rampRow = sign > 0 ? row - 2 + step : row + 3 - step;
      for (let lane = 0; lane < 2; lane++) {
        cells.push({
          col: col + lane,
          row: rampRow,
          height: (lowHeight + highHeight) / 2,
          shape: TILE_SHAPE.SLOPE,
          slope: {
            lowHeight,
            highHeight,
            riseDirection: sign > 0 ? SLOPE_DIRECTION.SOUTH : SLOPE_DIRECTION.NORTH,
          },
        });
      }
    }
    // Two exterior columns form the landing; the last column continues through
    // the logical door tile, meeting the actual sill at the castle boundary.
    for (let landingCol = col; landingCol <= end.col2 / 2; landingCol++) {
      for (let lane = 0; lane < 2; lane++) {
        cells.push({
          col: landingCol,
          row: row + lane,
          height: FOUNDATION_HEIGHT,
          shape: TILE_SHAPE.FLAT,
        });
      }
    }

    return cells;
  }

  /**
   * @param {number[][]} heightmap
   * @param {import("./MapGenerationTypes.js").TileMetadata[][]} tileMeta
   * @param {import("./MapGenerationTypes.js").MapLayout} layout
   * @param {number[][]} grid
   */
  static apply(heightmap, tileMeta, layout, grid) {
    for (const cell of this.cells(layout)) {
      heightmap[cell.row][cell.col] = cell.height;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: cell.height,
        shape: cell.shape,
        slope: cell.slope,
      };
    }
    if (!layout?.castleApproachRamp || !layout.castleApproach?.length) {
      return;
    }
    const corner = layout.castleApproach.at(-2);
    const previous = layout.castleApproach.at(-3);
    const borderCol = Math.floor(corner.col2 / 2) - 1;
    const firstRow = Math.floor(Math.min(corner.row2, previous.row2) / 2);
    const lastRow = Math.ceil(Math.max(corner.row2, previous.row2) / 2);
    // Keep a continuous turf bank outside the return leg, including the ramp
    // and landing. Never replace a route, river, or structure with grass.
    for (let row = firstRow; row <= lastRow; row++) {
      if (grid[row]?.[borderCol] !== MAP_TILE_TYPE.GRASS) {
        continue;
      }
      const height = Math.max(FOUNDATION_HEIGHT, heightmap[row][borderCol]);
      heightmap[row][borderCol] = height;
      tileMeta[row][borderCol] = {
        ...tileMeta[row][borderCol],
        baseHeight: height,
        shape: TILE_SHAPE.FLAT,
        surfaceType: "GRASS",
        slope: undefined,
      };
    }
  }
}

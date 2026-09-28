import {
  PATH_HEIGHT,
  FOUNDATION_HEIGHT,
} from "./mapGenerationConfig.js";
import {
  MAP_DIRECTION as DIRECTIONS,
} from "../../enum/MapDirection.js";
import {
  MAP_TILE_TYPE as TileType,
} from "../../enum/MapTileType.js";
import {
  MapGrid,
} from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 */

/**
 * Materializes the castle footprint and its two-lane entrance into the island grid.
 */
export class CastlePlacement {
  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   */
  placeCastle(grid, tileMeta, layout) {
    for (let row = layout.castleTop; row <= layout.castleBottom; row++) {
      for (let col = layout.castleLeft; col <= layout.castleRight; col++) {
        const isCorner =
          (row === layout.castleTop || row === layout.castleBottom) &&
          (col === layout.castleLeft || col === layout.castleRight);
        const isEntrance =
          col === layout.castleEntranceCol &&
          layout.castleEntranceRows.includes(row);

        if (isEntrance) {
          MapGrid.setTile(grid, tileMeta, col, row, TileType.PATH, {
            surfaceType: "PATH",
            baseHeight: PATH_HEIGHT,
            direction: DIRECTIONS.EAST,
          });
          continue;
        }

        MapGrid.setTile(
          grid,
          tileMeta,
          col,
          row,
          isCorner ? TileType.CASTLE_TOWER : TileType.CASTLE_WALL,
          {
            surfaceType: "STRUCTURE",
            baseHeight: FOUNDATION_HEIGHT,
          },
        );
      }
    }
  }
}

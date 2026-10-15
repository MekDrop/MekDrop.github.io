import { TILE_SHAPE } from "../../enum/TileShape.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 */

/**
 * Flat-grass eligibility shared by decoration placement and final validation.
 */
export class DecorationPlacementRules {
  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   * @param {number} col
   * @param {number} row
   */
  static isVegetationCandidate(grid, heightmap, tileMeta, layout, col, row) {
    if (!MapGrid.inBounds(col, row)) {
      return false;
    }
    if (grid[row][col] !== TileType.GRASS) {
      return false;
    }
    if (tileMeta[row][col].shape !== TILE_SHAPE.FLAT) {
      return false;
    }
    if (!Number.isFinite(heightmap[row][col])) {
      return false;
    }

    if (
      col >= layout.castleLeft - 2 &&
      col <= layout.castleRight + 2 &&
      row >= layout.castleTop - 2 &&
      row <= layout.castleBottom + 2
    ) {
      return false;
    }

    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        const neighborCol = col + deltaCol;
        const neighborRow = row + deltaRow;
        // Vegetation extends beyond its center tile, including after rotation.
        // Keep its surrounding footprint on the same flat grass surface.
        if (
          !this.isGroundCoverCandidate(
            grid, heightmap, tileMeta, neighborCol, neighborRow,
          ) ||
          heightmap[neighborRow][neighborCol] !== heightmap[row][col]
        ) {
          return false;
        }
        if (MapGrid.isRouteTile(grid[neighborRow][neighborCol])) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {number} col
   * @param {number} row
   */
  static isGroundCoverCandidate(grid, heightmap, tileMeta, col, row) {
    if (!MapGrid.inBounds(col, row)) {
      return false;
    }
    if (grid[row]?.[col] !== TileType.GRASS) {
      return false;
    }
    const metadata = tileMeta[row]?.[col];
    if (metadata?.surfaceType && metadata.surfaceType !== "GRASS") {
      return false;
    }
    if (metadata?.shape !== TILE_SHAPE.FLAT) {
      return false;
    }
    if (!Number.isFinite(heightmap[row][col])) {
      return false;
    }
    // Castle excavation can retain part of a grass tile beside a mirrored wall.
    // Reserve the patch's full envelope (model, rotation and seeded offset),
    // rather than treating that surviving strip as a safe planting surface.
    const x = col - (grid[row].length - 1) / 2;
    const z = row - (grid.length - 1) / 2;
    const y = heightmap[row][col];
    /**
     * @param {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}} cut
     */
    const overlapsGroundCut = (cut) => x + 0.75 > cut.minX && x - 0.75 < cut.maxX &&
        z + 0.75 > cut.minZ && z - 0.75 < cut.maxZ &&
        y + 1 > cut.minY && y < cut.maxY;
    if (metadata?.terrainCutouts?.some(overlapsGroundCut)) {
      return false;
    }
    return true;
  }
}

import {
  InsufficientVegetationVarietyError,
  InvalidGroundCoverPlacementError,
  InvalidStonePlacementError,
  InvalidVegetationPlacementError,
} from "../../errors/map/index.js";
import { STONE_COLORS } from "../../config/stoneStyles.js";
import { GROUND_COVER_VARIANTS, VEGETATION_VARIANTS } from "./mapGenerationConfig.js";
import { MapGrid } from "./MapGrid.js";
import { DecorationPlacementRules } from "./DecorationPlacementRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").GroundCoverData} GroundCoverData
 * @typedef {import("./MapGenerationTypes.js").VegetationPlacement} VegetationPlacement
 * @typedef {import("./MapGenerationTypes.js").StonePlacement} StonePlacement
 * @typedef {import("./MapGenerationTypes.js").StonePart} StonePart
 */

/**
 * Validates decoration eligibility, variety, and non-overlapping ownership.
 */
export class DecorationValidator {
  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   * @param {VegetationPlacement[]} vegetationPlacements
   */
  validateVegetation(
    grid,
    heightmap,
    tileMeta,
    layout,
    vegetationPlacements,
  ) {
    const occupied = new Set();
    const variants = new Set();
    for (const vegetation of vegetationPlacements) {
      const { col, row, variant } = vegetation;
      const key = MapGrid.tileKey(col, row);
      if (occupied.has(key)) {
        throw new InvalidVegetationPlacementError({
          col,
          row,
          reason: "duplicates another vegetation placement",
        });
      }
      if (
        !DecorationPlacementRules.isVegetationCandidate(
          grid,
          heightmap,
          tileMeta,
          layout,
          col,
          row,
        )
      ) {
        throw new InvalidVegetationPlacementError({
          col,
          row,
          reason: "is not on valid, path-cleared flat grass",
        });
      }
      if (!VEGETATION_VARIANTS.includes(variant)) {
        throw new InvalidVegetationPlacementError({
          col,
          row,
          reason: `uses unknown variation ${variant}`,
        });
      }
      occupied.add(key);
      variants.add(variant);
    }

    const expectedVariety = Math.min(5, vegetationPlacements.length);
    if (variants.size < expectedVariety) {
      throw new InsufficientVegetationVarietyError({
        expected: expectedVariety,
        actual: variants.size,
      });
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {VegetationPlacement[]} vegetationPlacements
   * @param {StonePlacement[]} stonePlacements
   */
  validateStones(
    grid,
    heightmap,
    tileMeta,
    vegetationPlacements,
    stonePlacements,
  ) {
    const occupied = new Set(
      vegetationPlacements.map(/**
       *
       * @param {{col: number, row: number}} options
       * @param {number} options.col
       * @param {number} options.row
       */
      ({ col, row }) => MapGrid.tileKey(col, row)),
    );
    const styles = new Set();
    for (const { col, row, parts } of stonePlacements) {
      const key = MapGrid.tileKey(col, row);
      if (
        occupied.has(key) ||
        !DecorationPlacementRules.isGroundCoverCandidate(grid, heightmap, tileMeta, col, row) ||
        !Array.isArray(parts) ||
        parts.length < 1 ||
        parts.length > 3 ||
        parts.some(
          /**
           *
           * @param {StonePart} options
           * @param {number} options.variant
           * @param {number} options.style
           * @param {string} options.color
           * @param {number} options.levels
           * @param {number} options.offsetX
           * @param {number} options.offsetZ
           * @param {number} options.diameter
           * @param {number} options.height
           */
          ({
            variant,
            style,
            color,
            levels,
            offsetX,
            offsetZ,
            diameter,
            height,
          }) =>
            !Number.isInteger(variant) ||
            variant < 0 ||
            variant > 2 ||
            !STONE_COLORS.includes(color) ||
            !Number.isInteger(levels) ||
            levels < 1 ||
            levels > 3 ||
            !Number.isInteger(style) ||
            style !==
              variant * STONE_COLORS.length + STONE_COLORS.indexOf(color) ||
            !Number.isFinite(offsetX) ||
            !Number.isFinite(offsetZ) ||
            !Number.isFinite(diameter) ||
            !Number.isFinite(height) ||
            Math.abs(offsetX) + diameter / 2 > 0.5 ||
            Math.abs(offsetZ) + diameter / 2 > 0.5 ||
            height <= 0 ||
            height > 0.8,
        )
      ) {
        throw new InvalidStonePlacementError({ col, row });
      }
      for (const { style } of parts) {
        if (styles.has(style)) {
          throw new InvalidStonePlacementError({ col, row });
        }
        styles.add(style);
      }
      occupied.add(key);
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {VegetationPlacement[]} vegetationPlacements
   * @param {StonePlacement[]} stonePlacements
   * @param {GroundCoverData} groundCoverData
   */
  validateGroundCover(
    grid,
    heightmap,
    tileMeta,
    vegetationPlacements,
    stonePlacements,
    groundCoverData,
  ) {
    const vegetationTiles = new Set(
      [...vegetationPlacements, ...stonePlacements].map(/**
       *
       * @param {{col: number, row: number}} options
       * @param {number} options.col
       * @param {number} options.row
       */
      ({ col, row }) =>
        MapGrid.tileKey(col, row),
      ),
    );
    for (const decoration of groundCoverData) {
      const { col, row, variant } = decoration;
      const key = MapGrid.tileKey(col, row);
      if (vegetationTiles.has(key)) {
        throw new InvalidGroundCoverPlacementError({
          col,
          row,
          reason: "overlaps vegetation or stones",
        });
      }
      if (!DecorationPlacementRules.isGroundCoverCandidate(grid, heightmap, tileMeta, col, row)) {
        throw new InvalidGroundCoverPlacementError({
          col,
          row,
          reason: "is not on valid flat grass",
        });
      }
      if (!GROUND_COVER_VARIANTS.includes(variant)) {
        throw new InvalidGroundCoverPlacementError({
          col,
          row,
          reason: `uses unknown variation ${variant}`,
        });
      }
    }
  }
}

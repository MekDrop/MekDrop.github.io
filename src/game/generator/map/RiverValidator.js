import {
  InvalidLavaRiverCountError,
  InvalidRiverCountError,
  InvalidRiverFlowError,
  InvalidRiverPathError,
} from "../../errors/map/index.js";
import { RIVER_KIND } from "../../enum/RiverKind.js";
import {
  MAX_RIVERS,
  MIN_RIVER_TILES,
  MAX_LAVA_ELIGIBLE_RIVERS,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";
import { RiverPlacementRules } from "./RiverPlacementRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 */

/**
 * Validates sources, continuous downstream flow, bridge crossings, banks, and waterfalls.
 */
export class RiverValidator {
  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   * @param {MapLayout} layout
   * @param {RiverData[]} riverData
   */
  validateRivers(
    grid,
    heightmap,
    tileMeta,
    islandMask,
    layout,
    riverData,
  ) {
    if (riverData.length > MAX_RIVERS) {
      throw new InvalidRiverCountError({
        count: riverData.length,
        maximum: MAX_RIVERS,
      });
    }
    const lavaRiverCount = riverData.filter(
      /**
       *
       * @param {RiverRecord} river
       */
      (river) => river.kind === RIVER_KIND.LAVA,
    ).length;
    if (
      lavaRiverCount > MAX_LAVA_ELIGIBLE_RIVERS ||
      (riverData.length > MAX_LAVA_ELIGIBLE_RIVERS && lavaRiverCount > 0)
    ) {
      throw new InvalidLavaRiverCountError({
        lavaCount: lavaRiverCount,
        riverCount: riverData.length,
        maximum: MAX_LAVA_ELIGIBLE_RIVERS,
      });
    }

    const occupied = new Set();
    const allRiverCells = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells.map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );
    const directionOffsets = {
      [DIRECTIONS.NORTH]: [0, -1],
      [DIRECTIONS.EAST]: [1, 0],
      [DIRECTIONS.SOUTH]: [0, 1],
      [DIRECTIONS.WEST]: [-1, 0],
    };
    for (const river of riverData) {
      const riverCells = new Set();
      if (
        river.cells.length < MIN_RIVER_TILES ||
        river.upstreamLength < 5
      ) {
        throw new InvalidRiverPathError({
          riverId: river.id,
          reason:
            "does not provide five inland flow tiles before its waterfall",
        });
      }
      if (
        river.source.terrainHeight < 2 ||
        !RiverPlacementRules.hasRiverSourceSetback(
          islandMask,
          river.source.col,
          river.source.row,
        )
      ) {
        throw new InvalidRiverPathError({
          riverId: river.id,
          reason:
            "does not begin on elevated terrain at least five tiles inland",
        });
      }

      const source = river.cells[0];
      const requiredSourceBankHeight = Math.ceil(
        source.elevation + RiverPlacementRules.riverSurfaceInset(river),
      );
      const riverCellKeys = new Set(
        river.cells.map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => MapGrid.tileKey(cell.col, cell.row)),
      );
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
          if (deltaCol === 0 && deltaRow === 0) {
            continue;
          }
          const bankCol = source.col + deltaCol;
          const bankRow = source.row + deltaRow;
          if (riverCellKeys.has(MapGrid.tileKey(bankCol, bankRow))) {
            continue;
          }
          if (
            !MapGrid.inBounds(bankCol, bankRow) ||
            grid[bankRow][bankCol] !== TileType.GRASS ||
            heightmap[bankRow][bankCol] < requiredSourceBankHeight
          ) {
            throw new InvalidRiverFlowError({
              riverId: river.id,
              reason: "does not have a complete raised-earth source enclosure",
            });
          }
        }
      }

      for (let index = 0; index < river.cells.length; index++) {
        const cell = river.cells[index];
        const key = MapGrid.tileKey(cell.col, cell.row);
        if (riverCells.has(key)) {
          throw new InvalidRiverPathError({
            riverId: river.id,
            reason: `reuses its own flow tile at (${cell.col}, ${cell.row})`,
          });
        }
        if (RiverPlacementRules.touchesOccupiedRiver(occupied, cell.col, cell.row)) {
          throw new InvalidRiverPathError({
            riverId: river.id,
            reason: `does not leave an earth-cell buffer around (${cell.col}, ${cell.row})`,
          });
        }
        riverCells.add(key);

        if (cell.underBridge) {
          if (
            grid[cell.row][cell.col] !== TileType.PATH ||
            tileMeta[cell.row][cell.col].renderMode !== "BRIDGE"
          ) {
            throw new InvalidRiverPathError({
              riverId: river.id,
              reason: `crosses a path without a bridge at (${cell.col}, ${cell.row})`,
            });
          }
        } else if (
          grid[cell.row][cell.col] !== TileType.WATER ||
          tileMeta[cell.row][cell.col].surfaceType !== "WATER"
        ) {
          throw new InvalidRiverPathError({
            riverId: river.id,
            reason: `contains a non-water flow tile at (${cell.col}, ${cell.row})`,
          });
        }

        if (!cell.underBridge) {
          const [flowCol, flowRow] = directionOffsets[cell.direction] ?? [0, 0];
          const crossCol = -flowRow;
          const crossRow = flowCol;
          const requiredBankHeight = Math.ceil(
            cell.elevation + RiverPlacementRules.riverSurfaceInset(river),
          );
          for (const side of [-1, 1]) {
            const bankCol = cell.col + crossCol * side;
            const bankRow = cell.row + crossRow * side;
            if (
              !MapGrid.inBounds(bankCol, bankRow) ||
              allRiverCells.has(MapGrid.tileKey(bankCol, bankRow))
            ) {
              continue;
            }
            const bankTile = grid[bankRow][bankCol];
            if (bankTile !== TileType.GRASS) {
              if (bankTile !== TileType.WATER) {
                continue;
              }
              throw new InvalidRiverFlowError({
                riverId: river.id,
                reason: `has a missing earth bank at (${bankCol}, ${bankRow})`,
              });
            }
            if (heightmap[bankRow][bankCol] < requiredBankHeight) {
              throw new InvalidRiverFlowError({
                riverId: river.id,
                reason: `has a low earth bank at (${bankCol}, ${bankRow})`,
              });
            }
          }
        }

        if (index === river.cells.length - 1) {
          continue;
        }
        const next = river.cells[index + 1];
        if (
          MapGrid.directionFromStep(cell, next) !== cell.direction ||
          next.elevation > cell.elevation
        ) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `flows uphill or loses direction at (${cell.col}, ${cell.row})`,
          });
        }
      }

      for (const key of riverCells) {
        occupied.add(key);
      }

      for (const cascade of river.cascades) {
        const [deltaCol, deltaRow] = directionOffsets[cascade.direction] ?? [
          0, 0,
        ];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const requiredBankHeight = Math.ceil(cascade.topElevation);
        for (const anchor of [cascade.from, cascade.to]) {
          for (const side of [-1, 1]) {
            const bankCol = anchor.col + crossCol * side;
            const bankRow = anchor.row + crossRow * side;
            if (
              !MapGrid.inBounds(bankCol, bankRow) ||
              grid[bankRow][bankCol] !== TileType.GRASS
            ) {
              continue;
            }
            if (heightmap[bankRow][bankCol] < requiredBankHeight) {
              throw new InvalidRiverFlowError({
                riverId: river.id,
                reason: `exposes the side of a cascade at (${bankCol}, ${bankRow})`,
              });
            }
          }
        }
      }

      const terminal = river.cells[river.cells.length - 1];
      const waterfall = river.waterfall;
      const [deltaCol, deltaRow] = directionOffsets[waterfall.direction] ?? [
        0, 0,
      ];
      const outsideCol = terminal.col + deltaCol;
      const outsideRow = terminal.row + deltaRow;
      if (
        terminal.direction !== waterfall.direction ||
        waterfall.col !== terminal.col ||
        waterfall.row !== terminal.row ||
        waterfall.bottomElevation >= waterfall.topElevation ||
        (MapGrid.inBounds(outsideCol, outsideRow) &&
          islandMask[outsideRow][outsideCol]) ||
        RiverPlacementRules.isNearGate(layout, terminal.col, terminal.row) ||
        RiverPlacementRules.isNearCastleForRiver(layout, terminal.col, terminal.row)
      ) {
        throw new InvalidRiverFlowError({
          riverId: river.id,
          reason: "does not end in a clear, outward-facing edge waterfall",
        });
      }

      const crossCol = -deltaRow;
      const crossRow = deltaCol;
      const requiredShoulderHeight = Math.ceil(
        terminal.elevation + RiverPlacementRules.riverSurfaceInset(river),
      );
      for (const side of [-1, 1]) {
        const shoulderCol = outsideCol + crossCol * side;
        const shoulderRow = outsideRow + crossRow * side;
        if (!MapGrid.inBounds(shoulderCol, shoulderRow)) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `places a waterfall shoulder outside the map at (${shoulderCol}, ${shoulderRow})`,
          });
        }
        if (allRiverCells.has(MapGrid.tileKey(shoulderCol, shoulderRow))) {
          continue;
        }
        const shoulderTile = grid[shoulderRow][shoulderCol];
        if (shoulderTile === TileType.WATER) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `has a missing waterfall shoulder at (${shoulderCol}, ${shoulderRow})`,
          });
        }
        if (
          shoulderTile === TileType.GRASS &&
          heightmap[shoulderRow][shoulderCol] < requiredShoulderHeight
        ) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `has a low waterfall shoulder at (${shoulderCol}, ${shoulderRow})`,
          });
        }
      }
    }
  }
}

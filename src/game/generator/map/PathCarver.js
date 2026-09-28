import {
  PATH_HEIGHT,
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
 * @typedef {import("./MapGenerationTypes.js").LayoutEntry} LayoutEntry
 */

/**
 * Carves complete two-lane paths and returns route ownership and merge reservations.
 */
export class PathCarver {
  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} startCol
   * @param {number} endCol
   * @param {number[]} rows
   * @param {string} direction
   * @param {string} type
   */
  #drawHorizontalPath(
    grid,
    tileMeta,
    startCol,
    endCol,
    rows,
    direction = null,
    type = TileType.PATH,
  ) {
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    const horizontalDirection =
      direction ??
      (startCol <= endCol ? DIRECTIONS.EAST : DIRECTIONS.WEST);

    for (const row of rows) {
      MapGrid.fillRect(grid, tileMeta, left, row, right, row, type, {
        surfaceType: type === TileType.ENTRY ? "STRUCTURE" : "PATH",
        baseHeight: PATH_HEIGHT,
        direction: horizontalDirection,
      });
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} colLeft
   * @param {number} top
   * @param {number} bottom
   */
  #drawVerticalPath(grid, tileMeta, colLeft, top, bottom) {
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    MapGrid.fillRect(
      grid,
      tileMeta,
      colLeft,
      low,
      colLeft + 1,
      high,
      TileType.PATH,
      {
        surfaceType: "PATH",
        baseHeight: PATH_HEIGHT,
        direction:
          top <= bottom ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH,
      },
    );
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} cells
   * @param {number} startCol
   * @param {number} endCol
   * @param {number[]} rows
   * @param {string} direction
   */
  #addHorizontalRoute(
    grid,
    tileMeta,
    cells,
    startCol,
    endCol,
    rows,
    direction = null,
  ) {
    this.#drawHorizontalPath(grid, tileMeta, startCol, endCol, rows, direction);
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    for (let col = left; col <= right; col++) {
      for (const row of rows) {
        cells.add(MapGrid.tileKey(col, row));
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} cells
   * @param {number} colLeft
   * @param {number} top
   * @param {number} bottom
   */
  #addVerticalRoute(grid, tileMeta, cells, colLeft, top, bottom) {
    this.#drawVerticalPath(grid, tileMeta, colLeft, top, bottom);
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    for (let row = low; row <= high; row++) {
      cells.add(MapGrid.tileKey(colLeft, row));
      cells.add(MapGrid.tileKey(colLeft + 1, row));
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} cells
   * @param {number} colLeft
   * @param {Array} firstRows
   * @param {Array} secondRows
   */
  #addVerticalRouteBetweenBands(
    grid,
    tileMeta,
    cells,
    colLeft,
    firstRows,
    secondRows,
  ) {
    const top = Math.min(firstRows[0], secondRows[0]);
    const bottom = Math.max(firstRows[1], secondRows[1]);
    this.#addVerticalRoute(grid, tileMeta, cells, colLeft, top, bottom);
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   */
  carvePaths(grid, tileMeta, layout) {
    const mergeZones = new Set();
    const routeCellsByPath = [];
    const trunkStart = Math.min(
      ...layout.entries.map(/**
       *
       * @param {LayoutEntry} entry
       */
      (entry) => entry.mergeCol),
    );

    this.#drawHorizontalPath(
      grid,
      tileMeta,
      trunkStart,
      layout.castleEntranceCol,
      layout.pathRows,
      DIRECTIONS.EAST,
    );

    for (let pathIdx = 0; pathIdx < layout.entries.length; pathIdx++) {
      const entry = layout.entries[pathIdx];
      const [topRow, bottomRow] = entry.gateRows;
      const cells = new Set();

      for (const row of entry.gateRows) {
        MapGrid.setTile(grid, tileMeta, entry.gateCol, row, TileType.ENTRY, {
          surfaceType: "STRUCTURE",
          baseHeight: PATH_HEIGHT,
          direction: entry.inwardDirection,
        });
        cells.add(MapGrid.tileKey(entry.gateCol, row));
      }

      if (entry.curvePlan) {
        const { bands, turnCols } = entry.curvePlan;
        const firstEnd =
          entry.inwardDirection === DIRECTIONS.EAST
            ? turnCols[0] + 1
            : turnCols[0];
        this.#addHorizontalRoute(
          grid,
          tileMeta,
          cells,
          entry.inwardDirection === DIRECTIONS.EAST
            ? entry.gateCol + 1
            : entry.gateCol - 1,
          firstEnd,
          entry.gateRows,
          entry.inwardDirection,
        );
        this.#addVerticalRouteBetweenBands(
          grid,
          tileMeta,
          cells,
          turnCols[0],
          entry.gateRows,
          bands[0],
        );

        for (let index = 0; index < bands.length; index++) {
          const startCol =
            entry.inwardDirection === DIRECTIONS.EAST
              ? turnCols[index]
              : turnCols[index] + 1;
          const endCol =
            index + 1 < turnCols.length
              ? entry.inwardDirection === DIRECTIONS.EAST
                ? turnCols[index + 1] + 1
                : turnCols[index + 1]
              : entry.inwardDirection === DIRECTIONS.EAST
                ? entry.mergeCol + 1
                : entry.mergeCol;
          this.#addHorizontalRoute(
            grid,
            tileMeta,
            cells,
            startCol,
            endCol,
            bands[index],
            entry.inwardDirection,
          );

          if (index + 1 < bands.length) {
            this.#addVerticalRouteBetweenBands(
              grid,
              tileMeta,
              cells,
              turnCols[index + 1],
              bands[index],
              bands[index + 1],
            );
          }
        }

        const finalBand = bands[bands.length - 1];
        if (bottomRow < layout.pathRows[0]) {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            finalBand[0],
            layout.pathRows[1],
          );
        } else {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            layout.pathRows[0],
            finalBand[1],
          );
        }
      } else {
        const horizontalStart =
          entry.inwardDirection === DIRECTIONS.EAST
            ? entry.gateCol + 1
            : entry.gateCol - 1;
        const horizontalEnd =
          entry.inwardDirection === DIRECTIONS.EAST
            ? entry.mergeCol + 1
            : entry.mergeCol;
        this.#addHorizontalRoute(
          grid,
          tileMeta,
          cells,
          horizontalStart,
          horizontalEnd,
          entry.gateRows,
          entry.inwardDirection,
        );

        if (bottomRow < layout.pathRows[0]) {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            topRow,
            layout.pathRows[1],
          );
        } else if (topRow > layout.pathRows[1]) {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            layout.pathRows[0],
            bottomRow,
          );
        }
      }

      for (let col = entry.mergeCol; col <= entry.mergeCol + 1; col++) {
        for (const row of layout.pathRows) {
          mergeZones.add(MapGrid.tileKey(col, row));
        }
      }

      routeCellsByPath.push({
        pathIdx,
        entry: {
          col: entry.gateCol,
          rows: [...entry.gateRows],
          side: entry.side,
        },
        mergeCol: entry.mergeCol,
        gateRows: [...entry.gateRows],
        routeCells: cells,
      });
    }

    return { mergeZones, routeCellsByPath, trunkStart };
  }
}

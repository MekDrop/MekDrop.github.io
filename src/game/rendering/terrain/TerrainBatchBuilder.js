import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import {
  CUBE_SCALE,
  FIXED_HEIGHTS,
  GRASS_SURFACE_TILES,
  SIDE_MATERIALS,
  SURFACE_ELEVATION_BIAS,
  SURFACE_MATERIALS,
} from "./TerrainMaterialMaps.js";

export class TerrainBatchBuilder {
  #mapData;
  #bridgeRailingKit;
  #cubeMaterials;
  #pathEarthSideMaterial;
  #grassEarthSideMaterial;
  #sideVariant;
  #addCubeMatrix;
  #addBoxMatrix;

  constructor({
    mapData,
    bridgeRailingKit,
    cubeMaterials,
    pathEarthSideMaterial,
    grassEarthSideMaterial,
    sideVariant,
    addCubeMatrix,
    addBoxMatrix,
  }) {
    this.#mapData = mapData;
    this.#bridgeRailingKit = bridgeRailingKit;
    this.#cubeMaterials = cubeMaterials;
    this.#pathEarthSideMaterial = pathEarthSideMaterial;
    this.#grassEarthSideMaterial = grassEarthSideMaterial;
    this.#sideVariant = sideVariant;
    this.#addCubeMatrix = addCubeMatrix;
    this.#addBoxMatrix = addBoxMatrix;
  }

  build(batches) {
    const { grid, heightmap, tileMeta, cols, rows } = this.#mapData;
    const processedBridgeCells = new Set();
    const riverCells = new Map(
      (this.#mapData.riverData ?? []).flatMap((river) =>
        river.cells.map((cell) => [`${cell.col},${cell.row}`, cell]),
      ),
    );
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const type = grid[row][col];
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        const renderMode = tileMeta?.[row]?.[col]?.renderMode ?? "SOLID";
        const height =
          type in FIXED_HEIGHTS ? FIXED_HEIGHTS[type] : heightmap[row][col];

        const riverCell = riverCells.get(`${col},${row}`);
        if (riverCell) {
          this.#addRiverbed(batches, riverCell, cols, rows);
        }
        if (type === TileType.WATER) {
          continue;
        }

        const slope = tileMeta?.[row]?.[col]?.slope;
        if (tileMeta?.[row]?.[col]?.shape === TILE_SHAPE.SLOPE && slope) {
          const usesOverpassStairs = Boolean(
            this.#mapData.overpassData?.stairApproach &&
              tileMeta[row][col].overpassId === this.#mapData.overpassData.id,
          );
          const baseHeight = usesOverpassStairs
            ? this.#mapData.overpassData.baseElevation
            : Math.floor(Math.min(slope.lowHeight, slope.highHeight));
          for (let level = 0; level < baseHeight; level += 1) {
            this.#addCubeMatrix(
              batches,
              "earth",
              this.#pathEarthSideMaterial(col, row, level),
              x,
              level + 0.5,
              z,
              "wallSidesOnly",
              level === 0 ? "earth" : "none",
            );
          }
          if (usesOverpassStairs) {
            continue;
          }
          const stage =
            Math.min(slope.lowHeight, slope.highHeight) - baseHeight < 0.25
              ? "Lower"
              : "Upper";
          const coverage = `slope${slope.riseDirection}${stage}`;
          this.#addBoxMatrix(
            batches,
            SURFACE_MATERIALS[type],
            this.#pathEarthSideMaterial(col, row, baseHeight),
            x,
            baseHeight,
            z,
            0,
            CUBE_SCALE,
            CUBE_SCALE,
            CUBE_SCALE,
            coverage,
            "none",
          );
          continue;
        }

        if (renderMode === "BRIDGE") {
          const bridgeKey = `${col},${row}`;
          if (processedBridgeCells.has(bridgeKey)) {
            continue;
          }
          const direction = tileMeta[row][col].direction;
          const span = this.#collectBridgeSpan(
            grid,
            heightmap,
            tileMeta,
            col,
            row,
            direction,
          );
          const railingMaterial = this.#sideVariant(
            SIDE_MATERIALS[type],
            col,
            row,
            height - 1,
          );
          const fasciaMaterial = tileMeta[row][col].overpassId
            ? this.#pathEarthSideMaterial(col, row, height - 1)
            : railingMaterial;
          for (const cell of span.cells) {
            processedBridgeCells.add(`${cell.col},${cell.row}`);
            const groundHeight = tileMeta[cell.row][cell.col].bridgeGroundHeight;
            if (Number.isFinite(groundHeight)) {
              this.#addBridgeGround(
                batches,
                cell.col,
                cell.row,
                groundHeight,
                cols,
                rows,
                Boolean(tileMeta[cell.row][cell.col].overpassId),
              );
            }
          }
          for (let position = span.start; position <= span.end; position += 1) {
            const deckCenterCol = span.horizontal ? position : span.crossCenter;
            const deckCenterRow = span.horizontal ? span.crossCenter : position;
            this.#addBoxMatrix(
              batches,
              SURFACE_MATERIALS[type],
              fasciaMaterial,
              deckCenterCol - (cols - 1) / 2,
              height - 0.12,
              deckCenterRow - (rows - 1) / 2,
              0,
              span.horizontal ? CUBE_SCALE : 2,
              0.24,
              span.horizontal ? 2 : CUBE_SCALE,
              "surfaceOnly",
              "none",
            );
          }
          this.#addBoxMatrix(
            batches,
            SURFACE_MATERIALS[type],
            fasciaMaterial,
            (span.horizontal ? span.center : span.crossCenter) -
              (cols - 1) / 2,
            height - 0.12,
            (span.horizontal ? span.crossCenter : span.center) -
              (rows - 1) / 2,
            0,
            span.horizontal ? span.length : 2,
            0.24,
            span.horizontal ? 2 : span.length,
            span.horizontal
              ? "bridgeHorizontalSidesOnly"
              : "bridgeVerticalSidesOnly",
            "none",
          );
          this.#bridgeRailingKit.addSpan(
            span,
            height,
            railingMaterial,
            cols,
            rows,
          );
          continue;
        }

        for (let level = 0; level < height; level += 1) {
          const topCube = level === height - 1;
          const overpassFill = Boolean(
            tileMeta?.[row]?.[col]?.overpassId && !tileMeta[row][col].overpass,
          );
          const { top, sides, underlay } = overpassFill
            ? {
                top: topCube ? SURFACE_MATERIALS[type] : "earth",
                sides: this.#pathEarthSideMaterial(col, row, level),
                underlay: "earth",
              }
            : this.#cubeMaterials(type, topCube, col, row, level);
          this.#addCubeMatrix(
            batches,
            top,
            sides,
            x,
            level + 0.5,
            z,
            this.#surfaceCoverage(topCube),
            level === 0 ? underlay : "none",
            topCube && GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0,
          );
        }
      }
    }

    for (const river of this.#mapData.riverData ?? []) {
      this.#addRiverSourceCap(batches, river.cells[0], cols, rows);
    }
    this.#addOverpassDeck(batches, cols, rows);
  }

  #addOverpassDeck(batches, cols, rows) {
    const overpass = this.#mapData.overpassData;
    if (!overpass) {
      return;
    }

    const { col, row } = overpass.crossing;
    const deckThickness = overpass.deckThickness ?? 0.24;
    const railingMaterial = this.#sideVariant(
      SIDE_MATERIALS[TileType.PATH],
      col,
      row,
      overpass.deckElevation - 1,
    );
    const fasciaMaterial = this.#pathEarthSideMaterial(
      col,
      row,
      overpass.deckElevation - 1,
    );
    for (let deckRow = row; deckRow <= row + 1; deckRow += 1) {
      this.#addBoxMatrix(
        batches,
        SURFACE_MATERIALS[TileType.PATH],
        fasciaMaterial,
        col + 0.5 - (cols - 1) / 2,
        overpass.deckElevation - deckThickness / 2,
        deckRow - (rows - 1) / 2,
        0,
        2,
        deckThickness,
        CUBE_SCALE,
        "surfaceOnly",
        "none",
      );
    }
    const span = {
      horizontal: false,
      start: row,
      end: row + 1,
      center: row + 0.5,
      crossCenter: col + 0.5,
      length: 2,
    };
    this.#addBoxMatrix(
      batches,
      SURFACE_MATERIALS[TileType.PATH],
      fasciaMaterial,
      span.crossCenter - (cols - 1) / 2,
      overpass.deckElevation - deckThickness / 2,
      span.center - (rows - 1) / 2,
      0,
      2,
      deckThickness,
      span.length,
      "bridgeVerticalSidesOnly",
      "none",
    );
    this.#bridgeRailingKit.addOverpass(overpass, railingMaterial, cols, rows);
  }

  #addRiverbed(batches, cell, cols, rows) {
    const { col, row, bedElevation } = cell;
    const x = col - (cols - 1) / 2;
    const z = row - (rows - 1) / 2;
    // Exposed cascade cliffs keep the neighboring bank's stone pattern and scale.
    for (let level = 0; level < bedElevation - 0.01; level += 1) {
      const layerHeight = Math.min(1, bedElevation - level);
      const stone = this.#grassEarthSideMaterial(col, row, level);
      this.#addBoxMatrix(
        batches,
        stone,
        stone,
        x,
        level + layerHeight / 2,
        z,
        0,
        CUBE_SCALE,
        layerHeight,
        CUBE_SCALE,
        "wallSidesOnly",
        level === 0 ? "earth" : "none",
      );
    }
    // One stone floor for every river cell, including zero-height beds and
    // cells beneath bridges. The same material covers exposed cascade ledges.
    const stone = this.#grassEarthSideMaterial(
      col,
      row,
      Math.max(0, bedElevation - 1),
    );
    this.#addBoxMatrix(
      batches,
      stone,
      stone,
      x,
      bedElevation - 0.5,
      z,
      0,
      CUBE_SCALE,
      1,
      CUBE_SCALE,
      "surfaceOnly",
      "none",
    );
  }

  #addBridgeGround(batches, col, row, height, cols, rows, dirtOnly = false) {
    const x = col - (cols - 1) / 2;
    const z = row - (rows - 1) / 2;
    for (let level = 0; level < height; level += 1) {
      const topCube = level === height - 1;
      const { top, sides, underlay } = dirtOnly
        ? {
            top: "earth",
            sides: this.#pathEarthSideMaterial(col, row, level),
            underlay: "earth",
          }
        : this.#cubeMaterials(TileType.GRASS, topCube, col, row, level);
      this.#addCubeMatrix(
        batches,
        top,
        sides,
        x,
        level + 0.5,
        z,
        this.#surfaceCoverage(topCube),
        level === 0 ? underlay : "none",
        topCube && !dirtOnly ? GRASS_SURFACE_LIFT : 0,
      );
    }
  }

  #addRiverSourceCap(batches, source, cols, rows) {
    if (!source) {
      return;
    }

    const capHeight = 1 / 3;
    const level = source.terrainHeight - 1;
    const { top, sides } = this.#cubeMaterials(
      TileType.GRASS,
      true,
      source.col,
      source.row,
      level,
    );
    const x = source.col - (cols - 1) / 2;
    const z = source.row - (rows - 1) / 2;
    const bodyHeight = capHeight + GRASS_SURFACE_LIFT;
    this.#addBoxMatrix(
      batches,
      top,
      sides,
      x,
      source.terrainHeight - capHeight / 2 + GRASS_SURFACE_LIFT / 2,
      z,
      0,
      CUBE_SCALE,
      bodyHeight,
      CUBE_SCALE,
      "wallSidesOnly",
      "earth",
    );
    const adjacentSurfaceHeight =
      source.terrainHeight +
      GRASS_SURFACE_LIFT +
      SURFACE_ELEVATION_BIAS * (CUBE_SCALE + GRASS_SURFACE_LIFT);
    this.#addBoxMatrix(
      batches,
      top,
      sides,
      x,
      adjacentSurfaceHeight - (0.5 + SURFACE_ELEVATION_BIAS),
      z,
      0,
      CUBE_SCALE,
      CUBE_SCALE,
      CUBE_SCALE,
      "surfaceOnly",
      "none",
    );
  }

  #bridgeMateCell(grid, tileMeta, col, row, direction) {
    const horizontal = direction === "EAST" || direction === "WEST";
    const candidates = horizontal
      ? [
          { col, row: row - 1 },
          { col, row: row + 1 },
        ]
      : [
          { col: col - 1, row },
          { col: col + 1, row },
        ];
    return (
      candidates.find(
        (candidate) =>
          grid[candidate.row]?.[candidate.col] === TileType.PATH &&
          tileMeta[candidate.row]?.[candidate.col]?.renderMode === "BRIDGE" &&
          tileMeta[candidate.row][candidate.col].direction === direction,
      ) ?? null
    );
  }

  #collectBridgeSpan(grid, heightmap, tileMeta, col, row, direction) {
    const horizontal = direction === "EAST" || direction === "WEST";
    const mate = this.#bridgeMateCell(grid, tileMeta, col, row, direction);
    const crossStart = mate
      ? Math.min(horizontal ? row : col, horizontal ? mate.row : mate.col)
      : horizontal
        ? row
        : col;
    const crossEnd = mate ? crossStart + 1 : crossStart;
    const height = heightmap[row][col];
    const isStation = (position) => {
      for (let cross = crossStart; cross <= crossEnd; cross += 1) {
        const stationCol = horizontal ? position : cross;
        const stationRow = horizontal ? cross : position;
        if (
          grid[stationRow]?.[stationCol] !== TileType.PATH ||
          tileMeta[stationRow]?.[stationCol]?.renderMode !== "BRIDGE" ||
          tileMeta[stationRow][stationCol].direction !== direction ||
          heightmap[stationRow]?.[stationCol] !== height
        ) {
          return false;
        }
      }
      return true;
    };
    let start = horizontal ? col : row;
    let end = start;
    while (isStation(start - 1)) {
      start -= 1;
    }
    while (isStation(end + 1)) {
      end += 1;
    }
    const cells = [];
    for (let position = start; position <= end; position += 1) {
      for (let cross = crossStart; cross <= crossEnd; cross += 1) {
        cells.push({
          col: horizontal ? position : cross,
          row: horizontal ? cross : position,
        });
      }
    }
    return {
      cells,
      horizontal,
      start,
      end,
      center: (start + end) / 2,
      crossCenter: (crossStart + crossEnd) / 2,
      length: end - start + 1,
    };
  }

  #surfaceCoverage(topCube) {
    if (!topCube) {
      return "none";
    }
    return "full";
  }
}

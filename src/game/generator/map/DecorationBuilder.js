import { STONE_COLORS } from "../../config/stoneStyles.js";
import {
  MAP_COLS,
  MAP_ROWS,
  STONE_LEVEL_WEIGHTS,
  TREE_VARIANTS,
  BUSH_VARIANTS,
  FLOWER_PATCH_VARIANTS,
  MUSHROOM_PATCH_VARIANTS,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";
import { GenerationRandom } from "./GenerationRandom.js";
import { DecorationPlacementRules } from "./DecorationPlacementRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 * @typedef {import("./MapGenerationTypes.js").VegetationPlacement} VegetationPlacement
 * @typedef {import("./MapGenerationTypes.js").StonePlacement} StonePlacement
 */

/**
 * Places vegetation, stones, ground cover, and vines using the generation random stream.
 */
export class DecorationBuilder {
  /**
   * @type {GenerationRandom}
   */
  #random;

  /**
   * @param {GenerationRandom} random
   */
  constructor(random) {
    this.#random = random;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   */
  placeVegetation(grid, heightmap, tileMeta, layout) {
    const candidates = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (
          DecorationPlacementRules.isVegetationCandidate(
            grid,
            heightmap,
            tileMeta,
            layout,
            col,
            row,
          )
        ) {
          candidates.push({ col, row });
        }
      }
    }

    if (!candidates.length) {
      return [];
    }

    const sparseTargetCount = MapGrid.clamp(
      Math.round(candidates.length / 35),
      12,
      24,
    );
    const targetCount = Math.min(candidates.length, sparseTargetCount * 9);
    const centerCount = MapGrid.clamp(Math.round(targetCount / 6), 18, 36);
    const centerCandidates = this.#random.shuffle([...candidates]);
    const centers = [];
    for (const candidate of centerCandidates) {
      if (
        centers.some(
          /**
           *
           * @param {GridCell} center
           */
          (center) =>
            Math.max(
              Math.abs(center.col - candidate.col),
              Math.abs(center.row - candidate.row),
            ) < 3,
        )
      ) {
        continue;
      }
      centers.push(candidate);
      if (centers.length === centerCount) { break; }
    }

    const selected = [];
    const occupied = new Set();
    /**
     *
     * @param {GridCell} candidate
     */
    const addCandidate = (candidate) => {
      const key = MapGrid.tileKey(candidate.col, candidate.row);
      if (occupied.has(key) || selected.length >= targetCount) {
        return;
      }
      occupied.add(key);
      selected.push(candidate);
    };

    for (const center of centers) {
      const nearby = this.#random.shuffle(
        candidates.filter(
          /**
           *
           * @param {GridCell} candidate
           */
          (candidate) =>
            Math.max(
              Math.abs(center.col - candidate.col),
              Math.abs(center.row - candidate.row),
            ) <= 2,
        ),
      );
      const clusterSize = this.#random.rng(5, 9);
      for (const candidate of nearby.slice(0, clusterSize)) {
        addCandidate(candidate);
      }
    }

    for (const candidate of this.#random.shuffle([...candidates])) {
      addCandidate(candidate);
    }

    const treeVariants = this.#random.shuffle([...TREE_VARIANTS]);
    const bushVariants = this.#random.shuffle([...BUSH_VARIANTS]);
    const treeCount = Math.round(selected.length * 0.8);
    const kinds = this.#random.shuffle(
      selected.map(/**
       *
       * @param {undefined} _
       * @param {number} index
       */
      (_, index) => (index < treeCount ? "tree" : "bush")),
    );
    let treeIndex = 0;
    let bushIndex = 0;
    return selected.map(/**
     *
     * @param {GridCell} candidate
     * @param {number} index
     */
    (candidate, index) => {
      const kind = kinds[index];
      const variant =
        kind === "tree"
          ? treeVariants[treeIndex++ % treeVariants.length]
          : bushVariants[bushIndex++ % bushVariants.length];
      return {
        ...candidate,
        variant,
        kind,
        rotation: this.#random.rng(0, 3) * 90,
      };
    });
  }

  #rollStoneLevels() {
    const roll = this.#random.rng(1, 100);
    if (roll <= STONE_LEVEL_WEIGHTS[0]) {
      return 1;
    }
    if (roll <= STONE_LEVEL_WEIGHTS[0] + STONE_LEVEL_WEIGHTS[1]) {
      return 2;
    }
    return 3;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {VegetationPlacement[]} vegetationPlacements
   * @param {string} mapName
   */
  placeStones(
    grid,
    heightmap,
    tileMeta,
    vegetationPlacements,
    mapName,
  ) {
    if (this.#random.hashMapName(`${mapName}:stone-presence`) % 10000 < 2827) {
      return [];
    }
    const occupied = new Set(
      vegetationPlacements.map(/**
       *
       * @param {{col: number, row: number}} options
       * @param {number} options.col
       * @param {number} options.row
       */
      ({ col, row }) => MapGrid.tileKey(col, row)),
    );
    const candidates = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (
          !occupied.has(MapGrid.tileKey(col, row)) &&
          DecorationPlacementRules.isGroundCoverCandidate(grid, heightmap, tileMeta, col, row)
        ) {
          candidates.push({ col, row });
        }
      }
    }
    const targetCount = Math.min(candidates.length, this.#random.rng(4, 10));
    const stones = [];
    const shuffledCandidates = this.#random.shuffle(candidates);
    const colors = this.#random.shuffle([...STONE_COLORS]);
    for (const candidate of shuffledCandidates) {
      if (
        stones.some(
          /**
           *
           * @param {{col: number, row: number}} options
           * @param {number} options.col
           * @param {number} options.row
           */
          ({ col, row }) =>
            Math.max(
              Math.abs(col - candidate.col),
              Math.abs(row - candidate.row),
            ) < 3,
        )
      ) {
        continue;
      }
      const variants = this.#random.shuffle([0, 1, 2]);
      const primaryLevels = this.#rollStoneLevels();
      const singlePartChance = primaryLevels === 1 ? 95 : 60;
      const partCount =
        this.#random.rng(1, 100) <= singlePartChance ? 1 : this.#random.rng(2, 3);
      const partPositions =
        partCount === 3
          ? [
              [-0.25, -0.25],
              [0.25, -0.25],
              [0, 0.25],
            ]
          : partCount === 2
            ? [
                [-0.25, 0],
                [0.25, 0],
              ]
            : [[0, 0]];
      const clusterRotation = partCount === 1 ? 0 : this.#random.rng(0, 3);
      const parts = Array.from({ length: partCount }, /**
       *
       * @param {undefined} _
       * @param {number} index
       */
      (_, index) => {
        const variant = variants[index];
        const color =
          colors[
            (stones.length + variant * Math.floor(colors.length / 3)) %
              colors.length
          ];
        const levels = index === 0 ? primaryLevels : this.#rollStoneLevels();
        // Bush cubes use 0.25-unit voxels; stones vary only slightly around that.
        const voxelSize = this.#random.rng(24, 26) / 100;
        const [slotX, slotZ] = partPositions[index];
        const rotatedPositions = [
          [slotX, slotZ],
          [-slotZ, slotX],
          [-slotX, -slotZ],
          [slotZ, -slotX],
        ];
        const [offsetX, offsetZ] = rotatedPositions[clusterRotation];
        return {
          variant,
          style: variant * STONE_COLORS.length + STONE_COLORS.indexOf(color),
          color,
          levels,
          offsetX: partCount === 1 ? this.#random.rng(-6, 6) / 100 : offsetX,
          offsetZ: partCount === 1 ? this.#random.rng(-6, 6) / 100 : offsetZ,
          diameter: partCount === 1 ? voxelSize * 3 : 0.4,
          height: voxelSize * levels,
          rotation: this.#random.rng(0, 3) * 90,
        };
      });
      stones.push({ ...candidate, parts });
      if (stones.length >= targetCount) {
        break;
      }
    }
    return stones;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {VegetationPlacement[]} vegetationPlacements
   * @param {StonePlacement[]} stonePlacements
   */
  placeGroundCover(
    grid,
    heightmap,
    tileMeta,
    vegetationPlacements,
    stonePlacements,
  ) {
    const occupied = new Set(
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
    const candidates = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (DecorationPlacementRules.isGroundCoverCandidate(grid, heightmap, tileMeta, col, row)) {
          candidates.push({ col, row });
        }
      }
    }

    const groundCover = [];
    for (const candidate of candidates) {
      const decorationTile = MapGrid.tileKey(candidate.col, candidate.row);
      if (!occupied.has(decorationTile) && this.#random.rng(0, 99) < 22) {
        groundCover.push(
          this.#createGroundCoverDecoration(
            candidate,
            this.#random.randomItem(FLOWER_PATCH_VARIANTS),
            this.#random.rng(-13, 13) / 100,
            this.#random.rng(-13, 13) / 100,
          ),
        );
      } else if (!occupied.has(decorationTile) && this.#random.rng(0, 99) < 4) {
        groundCover.push(
          this.#createGroundCoverDecoration(
            candidate,
            this.#random.randomItem(MUSHROOM_PATCH_VARIANTS),
            this.#random.rng(-15, 15) / 100,
            this.#random.rng(-15, 15) / 100,
          ),
        );
      }
    }
    return groundCover;
  }

  /**
   * @param {GridCell} candidate
   * @param {string} variant
   * @param {number} offsetX
   * @param {number} offsetZ
   */
  #createGroundCoverDecoration(candidate, variant, offsetX, offsetZ) {
    return {
      ...candidate,
      variant,
      offsetX,
      offsetZ,
      rotation: this.#random.rng(0, 23) * 15,
      scale: this.#random.rng(88, 112) / 100,
      phase: this.#random.rng(0, 628) / 100,
    };
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {boolean[][]} islandMask
   * @param {RiverData[]} riverData
   */
  placeCliffVines(grid, heightmap, islandMask, riverData) {
    const riverTiles = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells.map(/**
         *
         * @param {{col: number, row: number}} options
         * @param {number} options.col
         * @param {number} options.row
         */
        ({ col, row }) => MapGrid.tileKey(col, row)),
      ),
    );
    const directions = [
      { direction: DIRECTIONS.NORTH, deltaCol: 0, deltaRow: -1 },
      { direction: DIRECTIONS.EAST, deltaCol: 1, deltaRow: 0 },
      { direction: DIRECTIONS.SOUTH, deltaCol: 0, deltaRow: 1 },
      { direction: DIRECTIONS.WEST, deltaCol: -1, deltaRow: 0 },
    ];
    const candidates = [];

    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let col = 0; col < MAP_COLS; col += 1) {
        if (
          grid[row][col] !== TileType.GRASS ||
          !Number.isFinite(heightmap[row][col]) ||
          riverTiles.has(MapGrid.tileKey(col, row))
        ) {
          continue;
        }
        const topY = heightmap[row][col];
        for (const { direction, deltaCol, deltaRow } of directions) {
          const neighborCol = col + deltaCol;
          const neighborRow = row + deltaRow;
          const neighborIsIsland =
            MapGrid.inBounds(neighborCol, neighborRow) &&
            islandMask[neighborRow][neighborCol];
          if (
            neighborIsIsland &&
            (grid[neighborRow][neighborCol] === TileType.WATER ||
              riverTiles.has(MapGrid.tileKey(neighborCol, neighborRow)))
          ) {
            continue;
          }
          const bottomY = neighborIsIsland
            ? heightmap[neighborRow][neighborCol]
            : 0;
          if (!Number.isFinite(bottomY) || topY - bottomY < 0.9) {
            continue;
          }
          candidates.push({ col, row, direction, topY, bottomY });
        }
      }
    }

    const targetCount = Math.min(
      candidates.length,
      MapGrid.clamp(Math.round(candidates.length / 50), 1, 4),
    );
    const selected = [];
    const occupiedTiles = new Set();
    for (const candidate of this.#random.shuffle(candidates)) {
      const tileKey = MapGrid.tileKey(candidate.col, candidate.row);
      if (occupiedTiles.has(tileKey)) {
        continue;
      }
      const heightDifference = candidate.topY - candidate.bottomY;
      const topInset = this.#random.rng(4, 12) / 100;
      const maximumLength = heightDifference - topInset - 0.08;
      const length = Math.min(
        maximumLength,
        Math.max(0.46, (heightDifference * this.#random.rng(58, 88)) / 100),
      );
      selected.push({
        ...candidate,
        topY: candidate.topY - topInset,
        bottomY: candidate.topY - topInset - length,
        offset: this.#random.rng(-22, 22) / 100,
        width: this.#random.rng(13, 19) / 100,
        strandCount: this.#random.rng(2, 4),
        phase: this.#random.rng(0, 628) / 100,
      });
      occupiedTiles.add(tileKey);
      if (selected.length >= targetCount) {
        break;
      }
    }
    return selected;
  }
}

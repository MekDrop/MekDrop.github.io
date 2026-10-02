import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { OCCUPANCY } from "../../enum/Occupancy.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import {
  STEP_CLEARANCE,
  HERO_RADIUS,
  LEDGE_RADIUS,
  COLLISION_DISTANCE_EPSILON,
  WALKABLE_TILES,
  GRASS_SURFACE_TILES,
  STRUCTURE_SURFACE_TILES,
} from "./HeroSurfaceRules.js";

export class HeroTerrain {
  /**
   * @type {import("../ObjectTypes.js").GameMapData}
   */
  #mapData;

  /**
   * @type {import("./HeroSurfaceTypes.js").SurfaceCollisionWorld|null}
   */
  #collisionWorld;

  /**
   * @type {Array<import("./HeroSurfaceTypes.js").RiverSourceCover>}
   */
  #sourceCovers;

  /**
   * Terrain policy queries only; Ammo remains responsible for physical contact.
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   * @param {import("./HeroSurfaceTypes.js").SurfaceCollisionWorld|null} collisionWorld
   * @param {Array<import("./HeroSurfaceTypes.js").RiverSourceCover>} sourceCovers
   * @returns {function Object() { [native code] }}
   */
  constructor(mapData, collisionWorld, sourceCovers) {
    this.#mapData = mapData;
    this.#collisionWorld = collisionWorld;
    this.#sourceCovers = sourceCovers;
  }

  /**
   *
   * @param {number} fromX
   * @param {number} fromZ
   * @param {number} toX
   * @param {number} toZ
   * @param {boolean} checksEdges
   * @param {number} solidRadius
   * @param {import("./HeroSurfaceTypes.js").TerrainMovementState} state
   * @returns {string}
   */
  occupancyAt(
    fromX,
    fromZ,
    toX,
    toZ,
    checksEdges,
    solidRadius,
    state,
  ) {
    const collisionSurface =
      this.#collisionWorld?.surfaceHeightAt(toX, toZ, 0, state.position.y + STEP_CLEARANCE) ?? null;
    const gridX = toX + (this.#mapData.cols - 1) / 2;
    const gridZ = toZ + (this.#mapData.rows - 1) / 2;
    const searchRadius = Math.max(LEDGE_RADIUS, solidRadius);
    const firstCol = Math.floor(gridX - searchRadius + 0.5);
    const lastCol = Math.floor(gridX + searchRadius + 0.5);
    const firstRow = Math.floor(gridZ - searchRadius + 0.5);
    const lastRow = Math.floor(gridZ + searchRadius + 0.5);
    let currentSolidDistance = Number.POSITIVE_INFINITY;
    let nextSolidDistance = Number.POSITIVE_INFINITY;
    let currentEdgeDistance = Number.POSITIVE_INFINITY;
    let nextEdgeDistance = Number.POSITIVE_INFINITY;

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let col = firstCol; col <= lastCol; col += 1) {
        if (
          col < 0 ||
          row < 0 ||
          col >= this.#mapData.cols ||
          row >= this.#mapData.rows
        ) {
          if (
            !checksEdges ||
            state.dodging ||
            state.fallingToDeath
          ) {
            continue;
          }
          currentEdgeDistance = Math.min(
            currentEdgeDistance,
            this.#circleDistanceSquaredToTile(fromX, fromZ, col, row),
          );
          nextEdgeDistance = Math.min(
            nextEdgeDistance,
            this.#circleDistanceSquaredToTile(toX, toZ, col, row),
          );
          continue;
        }

        const type = this.#mapData.grid[row][col];
        const riverSourceCover =
          type === TileType.WATER
            ? this.#riverSourceCoverAtCell(col, row)
            : null;
        if (riverSourceCover) {
          continue;
        }
        if (!checksEdges && type === TileType.WATER) {
          continue;
        }
        const height = this.terrainSurfaceHeightAt(col, row, toX, toZ);
        const isStructureSurface =
          collisionSurface !== null && STRUCTURE_SURFACE_TILES.has(type);
        if (
          !WALKABLE_TILES.has(type) ||
          (!isStructureSurface &&
            height > state.position.y + STEP_CLEARANCE)
        ) {
          const isEdge = type === TileType.WATER;
          if (isEdge && state.dodging) {
            continue;
          }
          const currentDistance = this.#circleDistanceSquaredToTile(
            fromX,
            fromZ,
            col,
            row,
          );
          const nextDistance = this.#circleDistanceSquaredToTile(
            toX,
            toZ,
            col,
            row,
          );
          if (isEdge) {
            currentEdgeDistance = Math.min(
              currentEdgeDistance,
              currentDistance,
            );
            nextEdgeDistance = Math.min(nextEdgeDistance, nextDistance);
          } else {
            currentSolidDistance = Math.min(
              currentSolidDistance,
              currentDistance,
            );
            nextSolidDistance = Math.min(nextSolidDistance, nextDistance);
          }
        }
      }
    }
    if (
      this.#blocksTerrainMovement(
        currentSolidDistance,
        nextSolidDistance,
        solidRadius,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    if (
      this.#blocksTerrainMovement(
        currentEdgeDistance,
        nextEdgeDistance,
        LEDGE_RADIUS,
      )
    ) {
      return OCCUPANCY.edge;
    }
    return OCCUPANCY.open;
  }

  /**
   *
   * @param {number} currentDistance
   * @param {number} nextDistance
   * @param {number} radius
   * @returns {boolean}
   */
  #blocksTerrainMovement(currentDistance, nextDistance, radius) {
    if (nextDistance >= radius ** 2) {
      return false;
    }
    return !(
      currentDistance < radius ** 2 &&
      nextDistance >= currentDistance - COLLISION_DISTANCE_EPSILON
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} col
   * @param {number} row
   * @param {number} radius
   * @returns {boolean}
   */
  #circleOverlapsTile(x, z, col, row, radius = HERO_RADIUS) {
    return this.#circleDistanceSquaredToTile(x, z, col, row) < radius ** 2;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} col
   * @param {number} row
   * @returns {number}
   */
  #circleDistanceSquaredToTile(x, z, col, row) {
    const tileX = col - (this.#mapData.cols - 1) / 2;
    const tileZ = row - (this.#mapData.rows - 1) / 2;
    const distanceX = Math.max(Math.abs(x - tileX) - 0.5, 0);
    const distanceZ = Math.max(Math.abs(z - tileZ) - 0.5, 0);
    return distanceX * distanceX + distanceZ * distanceZ;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} maximumSupportHeight
   * @returns {number|null}
   */
  surfaceAt(x, z, maximumSupportHeight) {
    const collisionSurface = this.#collisionWorld?.surfaceHeightAt(
      x,
      z,
      LEDGE_RADIUS,
      maximumSupportHeight,
    );
    let highestSurface =
      Number.isFinite(collisionSurface) &&
      collisionSurface <= maximumSupportHeight
        ? collisionSurface
        : null;
    const sourceCoverHeight = this.riverSourceCoverHeightAt(x, z);
    if (
      sourceCoverHeight !== null &&
      sourceCoverHeight <= maximumSupportHeight
    ) {
      highestSurface =
        highestSurface === null
          ? sourceCoverHeight
          : Math.max(highestSurface, sourceCoverHeight);
    }
    const gridX = x + (this.#mapData.cols - 1) / 2;
    const gridZ = z + (this.#mapData.rows - 1) / 2;
    const firstCol = Math.floor(gridX - LEDGE_RADIUS + 0.5);
    const lastCol = Math.floor(gridX + LEDGE_RADIUS + 0.5);
    const firstRow = Math.floor(gridZ - LEDGE_RADIUS + 0.5);
    const lastRow = Math.floor(gridZ + LEDGE_RADIUS + 0.5);

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let col = firstCol; col <= lastCol; col += 1) {
        if (
          col < 0 ||
          row < 0 ||
          col >= this.#mapData.cols ||
          row >= this.#mapData.rows ||
          !this.#circleOverlapsTile(x, z, col, row, LEDGE_RADIUS)
        ) {
          continue;
        }
        const type = this.#mapData.grid[row][col];
        if (!WALKABLE_TILES.has(type)) {
          continue;
        }
        const terrainSurface = this.terrainSurfaceHeightAt(col, row, x, z);
        const overpassSurface =
          this.#mapData.tileMeta?.[row]?.[col]?.overpass?.elevation;
        for (const surfaceHeight of [terrainSurface, overpassSurface]) {
          if (
            !Number.isFinite(surfaceHeight) ||
            surfaceHeight > maximumSupportHeight ||
            (highestSurface !== null && surfaceHeight <= highestSurface)
          ) {
            continue;
          }
          highestSurface = surfaceHeight;
        }
      }
    }
    return highestSurface;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} maximumHeight
   * @returns {number|null}
   */
  supportHeightAtPoint(x, z, maximumHeight) {
    const col = Math.round(x + (this.#mapData.cols - 1) / 2);
    const row = Math.round(z + (this.#mapData.rows - 1) / 2);
    if (
      col < 0 ||
      row < 0 ||
      col >= this.#mapData.cols ||
      row >= this.#mapData.rows
    ) {
      return null;
    }
    const type = this.#mapData.grid[row][col];
    if (!WALKABLE_TILES.has(type)) {
      const sourceCoverHeight =
        type === TileType.WATER
          ? this.riverSourceCoverHeightAt(x, z, col, row)
          : null;
      return sourceCoverHeight !== null && sourceCoverHeight <= maximumHeight
        ? sourceCoverHeight
        : null;
    }
    // Authored stairs extend onto approach PATH/GRASS cells, not just the
    // castle's foundation tiles. Sample their support for feet and landing too.
    const collisionSurface = this.#collisionWorld?.surfaceHeightAt(x, z, 0, maximumHeight);
    let highestSurface =
      Number.isFinite(collisionSurface) && collisionSurface <= maximumHeight
        ? collisionSurface
        : null;
    const terrainSurface = this.terrainSurfaceHeightAt(col, row, x, z);
    const overpassSurface =
      this.#mapData.tileMeta?.[row]?.[col]?.overpass?.elevation;
    for (const surfaceHeight of [terrainSurface, overpassSurface]) {
      if (
        Number.isFinite(surfaceHeight) &&
        surfaceHeight <= maximumHeight &&
        (highestSurface === null || surfaceHeight > highestSurface)
      ) {
        highestSurface = surfaceHeight;
      }
    }
    return highestSurface;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  terrainSurfaceHeightAt(col, row, x, z) {
    const type = this.#mapData.grid[row][col];
    const metadata = this.#mapData.tileMeta?.[row]?.[col];
    const slope = metadata?.slope;
    if (metadata?.shape === TILE_SHAPE.SLOPE && slope) {
      const gridX = x + (this.#mapData.cols - 1) / 2;
      const gridZ = z + (this.#mapData.rows - 1) / 2;
      const localX = Math.max(0, Math.min(1, gridX - col + 0.5));
      const localZ = Math.max(0, Math.min(1, gridZ - row + 0.5));
      const progress =
        slope.riseDirection === SLOPE_DIRECTION.NORTH
          ? 1 - localZ
          : slope.riseDirection === SLOPE_DIRECTION.SOUTH
            ? localZ
            : slope.riseDirection === SLOPE_DIRECTION.WEST
              ? 1 - localX
              : localX;
      return slope.lowHeight +
        (slope.highHeight - slope.lowHeight) * progress;
    }
    return (
      this.#mapData.heightmap[row][col] +
      (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0)
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  isBeyondMapEdge(x, z) {
    const gridX = x + (this.#mapData.cols - 1) / 2;
    const gridZ = z + (this.#mapData.rows - 1) / 2;
    return (
      gridX < -0.5 ||
      gridZ < -0.5 ||
      gridX > this.#mapData.cols - 0.5 ||
      gridZ > this.#mapData.rows - 0.5
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number|null} col
   * @param {number|null} row
   * @returns {number|null}
   */
  riverSourceCoverHeightAt(x, z, col = null, row = null) {
    const epsilon = 0.000001;
    for (const cover of this.#sourceCovers) {
      if (
        (col !== null && cover.col !== col) ||
        (row !== null && cover.row !== row)
      ) {
        continue;
      }
      const relativeX = x - cover.centerX;
      const relativeZ = z - cover.centerZ;
      const forward = relativeX * cover.flowX + relativeZ * cover.flowZ;
      const across = -relativeX * cover.flowZ + relativeZ * cover.flowX;
      if (
        forward >= -0.5 - epsilon &&
        forward <= 0.5 + epsilon &&
        Math.abs(across) <= 0.5 + epsilon
      ) {
        return cover.height;
      }
    }
    return null;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @returns {import("./HeroSurfaceTypes.js").RiverSourceCover|null}
   */
  #riverSourceCoverAtCell(col, row) {
    return (
      this.#sourceCovers.find(
        /**
         *
         * @param {import("./HeroSurfaceTypes.js").RiverSourceCover} cover
         */
        (cover) => cover.col === col && cover.row === row,
      ) ?? null
    );
  }
}

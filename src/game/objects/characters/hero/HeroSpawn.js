import { MAP_TILE_TYPE as TileType } from "../../../enum/MapTileType.js";
import { GRASS_SURFACE_LIFT } from "../../../config/terrain.js";
import {
  HERO_RADIUS,
  STEP_CLEARANCE,
  WALKABLE_TILES,
  GRASS_SURFACE_TILES,
} from "./HeroSurfaceRules.js";

/**
 * Selects the hero's initial safe ground and facing from map geometry.
 */
export class HeroSpawn {
  /**
   * @type {import("src/game/objects/ObjectTypes.js").GameMapData}
   */
  #mapData;
  /**
   * @type {import("../../../collision/GroundCollisionWorld.js").GroundCollisionWorld}
   */
  #collisionWorld;
  /**
   * @type {{x: number, z: number}}
   */
  #spawnCenter;

  /**
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} mapData
   * @param {import("../../../collision/GroundCollisionWorld.js").GroundCollisionWorld} collisionWorld
   * @param {{x: number, z: number}} spawnCenter
   */
  constructor(mapData, collisionWorld, spawnCenter) {
    this.#mapData = mapData;
    this.#collisionWorld = collisionWorld;
    this.#spawnCenter = spawnCenter;
  }

  /**
   * @returns {{x: number, y: number, z: number}}
   */
  get position() {
    const explicitSpawn = this.#mapData.heroSpawn;
    if (
      Number.isFinite(explicitSpawn?.x) &&
      Number.isFinite(explicitSpawn?.y) &&
      Number.isFinite(explicitSpawn?.z)
    ) {
      return { ...explicitSpawn };
    }

    const { castle, cols, rows } = this.#mapData;
    const grassTiles = [];
    const safeGrassTiles = [];
    const castleLeft = castle?.position?.col;
    const castleTop = castle?.position?.row;
    const castleRight = castleLeft + (castle?.position?.width ?? 0) - 1;
    const castleBottom = castleTop + (castle?.position?.depth ?? 0) - 1;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (this.#mapData.grid[row][col] !== TileType.GRASS) {
          continue;
        }
        const behindCastle =
          Number.isFinite(castleRight) &&
          Number.isFinite(castleTop) &&
          col > castleRight &&
          row >= castleTop - 1 &&
          row <= castleBottom + 1;
        if (behindCastle) {
          continue;
        }
        const tile = {
          col,
          row,
        };
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        const elevation =
          this.#mapData.heightmap[row][col] + GRASS_SURFACE_LIFT;
        if (
          this.#collisionWorld?.isBlocked(
            x,
            z,
            HERO_RADIUS,
            elevation,
            STEP_CLEARANCE,
          )
        ) {
          continue;
        }
        grassTiles.push(tile);
        if (!this.#hasSpawnExit(col, row)) {
          continue;
        }
        safeGrassTiles.push(tile);
      }
    }

    const candidates = safeGrassTiles.length ? safeGrassTiles : grassTiles;
    if (candidates.length) {
      const centerCol = this.#spawnCenter.x + (cols - 1) / 2;
      const centerRow = this.#spawnCenter.z + (rows - 1) / 2;
      const tile = candidates.reduce(/**
       *
       * @param {{col: number, row: number}|null} closest
       * @param {{col: number, row: number}} candidate
       */
        (closest, candidate) => {
          if (!closest) {
            return candidate;
          }
          const candidateDistance =
            (candidate.col - centerCol) ** 2 +
          (candidate.row - centerRow) ** 2;
          const closestDistance =
            (closest.col - centerCol) ** 2 +
          (closest.row - centerRow) ** 2;

          return candidateDistance < closestDistance ? candidate : closest;
        }, null);

      return {
        x: tile.col - (cols - 1) / 2,
        y: this.#mapData.heightmap[tile.row][tile.col] + GRASS_SURFACE_LIFT,
        z: tile.row - (rows - 1) / 2,
      };
    }

    return {
      x: 0,
      y: 1,
      z: 0,
    };
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   */
  #hasSpawnExit(col, row) {
    const height = this.#mapData.heightmap[row][col];
    let exits = 0;
    for (const [deltaCol, deltaRow] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const neighbourCol = col + deltaCol;
      const neighbourRow = row + deltaRow;
      if (
        neighbourCol < 0 ||
        neighbourRow < 0 ||
        neighbourCol >= this.#mapData.cols ||
        neighbourRow >= this.#mapData.rows
      ) {
        continue;
      }
      if (
        !WALKABLE_TILES.has(this.#mapData.grid[neighbourRow][neighbourCol]) ||
        this.#mapData.heightmap[neighbourRow][neighbourCol] > height
      ) {
        continue;
      }
      const x = neighbourCol - (this.#mapData.cols - 1) / 2;
      const z = neighbourRow - (this.#mapData.rows - 1) / 2;
      const type = this.#mapData.grid[neighbourRow][neighbourCol];
      const elevation =
        this.#mapData.heightmap[neighbourRow][neighbourCol] +
        (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0);
      if (
        this.#collisionWorld?.isBlocked(
          x,
          z,
          HERO_RADIUS,
          elevation,
          STEP_CLEARANCE,
        )
      ) {
        continue;
      }
      exits += 1;
    }

    return exits >= 2;
  }

  /**
   * @param {{x: number, z: number}} position
   * @returns {number}
   */
  facingYaw(position) {
    const { castle, cols, rows } = this.#mapData;
    const castlePosition = castle?.position;
    if (!castlePosition) {
      return 0;
    }

    const castleCenterX =
      castlePosition.col +
      (castlePosition.width - 1) / 2 -
      (cols - 1) / 2;
    const castleCenterZ =
      castlePosition.row +
      (castlePosition.depth - 1) / 2 -
      (rows - 1) / 2;
    const directionX = castleCenterX - position.x;
    const directionZ = castleCenterZ - position.z;
    if (Math.hypot(directionX, directionZ) <= 0.001) {
      return 0;
    }

    return (Math.atan2(directionX, directionZ) * 180) / Math.PI;
  }
}

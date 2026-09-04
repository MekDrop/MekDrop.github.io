import { TileType } from "../../MapGenerator.js";

const MAX_UNDERSIDE_DEPTH = 9;

export class SkyIslandScenery {
  #mapData;
  #seed;

  constructor(mapData) {
    this.#mapData = mapData;
    this.#seed = this.#hashString(mapData.layoutSignature ?? "sky-island");
  }

  createUndersideVoxels() {
    const { grid, cols, rows } = this.#mapData;
    const edgeDistances = this.#buildEdgeDistances();
    const voxels = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (grid[row][col] === TileType.WATER) continue;

        const edgeDistance = edgeDistances[row][col];
        const ridgeNoise = this.#hash(
          Math.floor(col / 3),
          Math.floor(row / 3),
          17,
        );
        const detailNoise = this.#hash(col, row, 31);
        const hangingTip = detailNoise % 11 === 0 ? 2 : 0;
        const depth = Math.min(
          MAX_UNDERSIDE_DEPTH,
          1 +
            Math.floor(edgeDistance * 1.15) +
            (ridgeNoise % 3) +
            (detailNoise % 2) +
            hangingTip,
        );

        for (let layer = 1; layer <= depth; layer += 1) {
          voxels.push({
            col,
            row,
            level: -layer,
            rocky: layer > 1 || edgeDistance > 2,
          });
        }
      }
    }

    return voxels;
  }

  #buildEdgeDistances() {
    const { grid, cols, rows } = this.#mapData;
    const distances = Array.from({ length: rows }, () =>
      new Array(cols).fill(Number.POSITIVE_INFINITY),
    );
    const queue = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (grid[row][col] === TileType.WATER) continue;
        const touchesVoid = [
          [col - 1, row],
          [col + 1, row],
          [col, row - 1],
          [col, row + 1],
        ].some(
          ([neighborCol, neighborRow]) =>
            neighborCol < 0 ||
            neighborCol >= cols ||
            neighborRow < 0 ||
            neighborRow >= rows ||
            grid[neighborRow][neighborCol] === TileType.WATER,
        );
        if (!touchesVoid) continue;
        distances[row][col] = 1;
        queue.push([col, row]);
      }
    }

    for (let index = 0; index < queue.length; index += 1) {
      const [col, row] = queue[index];
      const nextDistance = distances[row][col] + 1;
      for (const [neighborCol, neighborRow] of [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1],
      ]) {
        if (
          neighborCol < 0 ||
          neighborCol >= cols ||
          neighborRow < 0 ||
          neighborRow >= rows ||
          grid[neighborRow][neighborCol] === TileType.WATER ||
          distances[neighborRow][neighborCol] <= nextDistance
        ) {
          continue;
        }
        distances[neighborRow][neighborCol] = nextDistance;
        queue.push([neighborCol, neighborRow]);
      }
    }

    return distances;
  }

  #hash(first, second, salt) {
    let value = this.#seed ^ salt;
    value = Math.imul(value ^ (first + 101), 2246822519);
    value = Math.imul(value ^ (second + 211), 3266489917);
    value ^= value >>> 16;
    return value >>> 0;
  }

  #hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}

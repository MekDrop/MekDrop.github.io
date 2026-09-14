import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";

const CLUMPS_PER_TILE = 144;

// Placement only: the reusable blade geometry lives in meadow-grass.blend.
export class GrassCarpetLayout {
  static create(mapData) {
    const placements = [];
    const { grid, heightmap, tileMeta, cols, rows } = mapData;
    let mapSeed = 0;
    for (const character of mapData.mapName ?? "") {
      mapSeed = Math.imul(mapSeed, 31) + character.charCodeAt(0) | 0;
    }
    const sourceCovers = new Map(
      (mapData.riverData ?? []).flatMap(({ cells }) =>
        cells[0] ? [[`${cells[0].col},${cells[0].row}`, cells[0].terrainHeight]] : [],
      ),
    );
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const metadata = tileMeta?.[row]?.[col];
        const sourceHeight = sourceCovers.get(`${col},${row}`);
        const surfaceHeight = sourceHeight ?? heightmap[row][col];
        if (
          (grid[row][col] !== TileType.GRASS && sourceHeight === undefined) ||
          surfaceHeight <= 0 ||
          metadata?.shape === TILE_SHAPE.SLOPE ||
          metadata?.renderMode === "BRIDGE"
        ) {
          continue;
        }
        for (let index = 0; index < CLUMPS_PER_TILE; index += 1) {
          const seed = mapSeed ^ col * 73856093 ^ row * 19349663 ^ index * 83492791;
          const random = (salt) => this.#random(seed ^ salt);
          // Cover the tile up to its edges; the shader clips bent tips to the
          // cell boundary so neither growth nor contact spills onto roads.
          const offsetX = (random(11) - 0.5) * 0.98;
          const offsetZ = (random(23) - 0.5) * 0.98;
          const broadleaf = random(89) < 0.045;
          const fineBlade = !broadleaf && random(97) < 0.28;
          placements.push({
            x: col - (cols - 1) / 2 + offsetX,
            y: surfaceHeight + GRASS_SURFACE_LIFT - 0.012,
            z: row - (rows - 1) / 2 + offsetZ,
            rotation: random(37) * 360,
            width: broadleaf ? 0.68 + random(53) * 0.22 :
              fineBlade ? 0.32 + random(53) * 0.08 : 0.5 + random(53) * 0.08,
            height: broadleaf ? 0.3 + random(71) * 0.07 : 0.13 + random(71) * 0.06,
            broadleaf,
            chunk: `${Math.floor(col / 6)},${Math.floor(row / 6)}`,
            detail: index % 2 === 1,
            edgeX: 0,
            edgeZ: 0,
          });
        }
        for (const [edgeX, edgeZ] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const neighborCol = col + edgeX;
          const neighborRow = row + edgeZ;
          const neighborType = grid[neighborRow]?.[neighborCol];
          const neighborHeight = sourceCovers.get(`${neighborCol},${neighborRow}`) ??
            heightmap[neighborRow]?.[neighborCol] ?? 0;
          if (
            (neighborType !== undefined && neighborType !== TileType.GRASS && neighborType !== TileType.WATER) ||
            neighborHeight >= surfaceHeight - 0.25
          ) {
            continue;
          }
          for (let index = 0; index < 18; index += 1) {
            const seed = mapSeed ^ col * 73856093 ^ row * 19349663 ^
              index * 83492791 ^ (edgeX + 2 * edgeZ) * 1376312589;
            const random = (salt) => this.#random(seed ^ salt);
            const alongEdge = (random(11) - 0.5) * 0.94;
            placements.push({
              x: col - (cols - 1) / 2 + edgeX * 0.475 + edgeZ * alongEdge,
              y: surfaceHeight + GRASS_SURFACE_LIFT - 0.016 - random(23) * 0.025,
              z: row - (rows - 1) / 2 + edgeZ * 0.475 + edgeX * alongEdge,
              rotation: random(37) * 360,
              width: 0.32 + random(53) * 0.12,
              height: 0.18 + random(71) * 0.07,
              chunk: `${Math.floor(col / 6)},${Math.floor(row / 6)}`,
              detail: false,
              broadleaf: random(89) < 0.16,
              edgeX,
              edgeZ,
            });
          }
        }
      }
    }
    return placements;
  }

  static #random(seed) {
    let value = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }
}

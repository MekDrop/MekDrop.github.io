import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";

const CLUMPS_PER_TILE = 72;

export class GrassCarpetLayout {
  static create(mapData) {
    const placements = [];
    const { grid, heightmap, tileMeta, cols, rows } = mapData;
    const castlePosition = mapData.castle?.position;
    let mapSeed = 0;
    for (const character of mapData.mapName ?? "") {
      mapSeed = (Math.imul(mapSeed, 31) + character.charCodeAt(0)) | 0;
    }
    const stoneParts = (mapData.stoneData ?? []).flatMap(
      ({ col, row, parts }) =>
        parts.map(({ offsetX, offsetZ, diameter }) => ({
          x: col - (cols - 1) / 2 + offsetX,
          z: row - (rows - 1) / 2 + offsetZ,
          radius: diameter / 2,
        })),
    );
    const sourceCovers = new Map(
      (mapData.riverData ?? []).flatMap(({ cells }) =>
        cells[0]
          ? [[`${cells[0].col},${cells[0].row}`, cells[0].terrainHeight]]
          : [],
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
        const nearbyStones = stoneParts.filter(
          ({ x, z }) =>
            Math.abs(x - (col - (cols - 1) / 2)) < 1.5 &&
            Math.abs(z - (row - (rows - 1) / 2)) < 1.5,
        );
        const castleRearGrass =
          castlePosition &&
          col === castlePosition.col + castlePosition.width &&
          row >= castlePosition.row &&
          row < castlePosition.row + castlePosition.depth;
        let exposedSides = 0;
        // West, north, east, south. Continuous lawn can cross internal seams;
        // cliffs allow short tips, while paving gets only a tiny soft overlap.
        const boundaryExtension = [
          [-1, 0],
          [0, -1],
          [1, 0],
          [0, 1],
        ].map(([dx, dz], side) => {
          const neighborCol = col + dx;
          const neighborRow = row + dz;
          const neighborType = grid[neighborRow]?.[neighborCol];
          const neighborSource = sourceCovers.get(
            `${neighborCol},${neighborRow}`,
          );
          const neighborHeight =
            neighborSource ?? heightmap[neighborRow]?.[neighborCol] ?? 0;
          const neighborMeta = tileMeta?.[neighborRow]?.[neighborCol];
          if (neighborHeight < surfaceHeight - 0.25) {
            exposedSides |= 1 << side;
            return 0.06;
          }
          if (
            Math.abs(neighborHeight - surfaceHeight) > 0.01 ||
            neighborMeta?.shape === TILE_SHAPE.SLOPE ||
            neighborMeta?.renderMode === "BRIDGE"
          ) {
            return 0;
          }
          if (neighborType === TileType.GRASS || neighborSource !== undefined) {
            return 0.24;
          }
          return neighborType === TileType.PATH ||
            neighborType === TileType.ENTRY
            ? 0.04
            : 0;
        });
        for (let index = 0; index < CLUMPS_PER_TILE; index += 1) {
          const seed =
            mapSeed ^ (col * 73856093) ^ (row * 19349663) ^ (index * 83492791);
          const random = (salt) => this.#random(seed ^ salt);
          const offsetX = (random(11) - 0.5) * 0.98;
          const offsetZ = (random(23) - 0.5) * 0.98;
          const broadleaf = random(89) < 0.045;
          const fineBlade = !broadleaf && random(97) < 0.28;
          const width = broadleaf
            ? 0.68 + random(53) * 0.22
            : fineBlade
              ? 0.32 + random(53) * 0.08
              : 0.5 + random(53) * 0.08;
          const x = col - (cols - 1) / 2 + offsetX;
          const z = row - (rows - 1) / 2 + offsetZ;
          const stoneInfluence = nearbyStones.reduce((strength, stone) => {
            const edgeDistance =
              Math.hypot(x - stone.x, z - stone.z) - stone.radius;
            return Math.max(
              strength,
              edgeDistance >= 0 ? Math.max(0, 1 - edgeDistance / 0.55) : 0,
            );
          }, 0);
          const normalHeight = broadleaf
            ? 0.3 + random(71) * 0.07
            : 0.13 + random(71) * 0.06;
          const tallerGrass =
            !broadleaf &&
            stoneInfluence > 0 &&
            random(109) < stoneInfluence * 0.48;
          const grassHeight = broadleaf
            ? normalHeight
            : tallerGrass
              ? normalHeight + stoneInfluence * (0.18 + random(113) * 0.2)
              : normalHeight * (1 + stoneInfluence * 0.35);
          // The same scatter and clump shapes continue all the way to the
          // boundary. A separate edge row would read as an added border.
          placements.push({
            x,
            y: surfaceHeight + GRASS_SURFACE_LIFT - 0.002,
            z,
            rotation: random(37) * 360,
            width: tallerGrass ? width * (1 + stoneInfluence * 0.2) : width,
            height: grassHeight,
            broadleaf,
            exposedSides,
            boundaryExtension,
            chunk: `${Math.floor(col / 6)},${Math.floor(row / 6)}`,
            detail: index % 3 !== 0,
            castleRearGrass: Boolean(castleRearGrass),
          });
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

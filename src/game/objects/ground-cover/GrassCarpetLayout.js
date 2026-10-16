import { TileType } from "../../generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";

const CLUMPS_PER_TILE = 72;

export class GrassCarpetLayout {
  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} mapData
   */
  static create(mapData) {
    const placements = [];
    const { grid, heightmap, tileMeta, cols, rows } = mapData;
    const castlePosition = mapData.castle?.position;
    let mapSeed = 0;
    for (const character of mapData.mapName ?? "") {
      mapSeed = (Math.imul(mapSeed, 31) + character.charCodeAt(0)) | 0;
    }
    const stoneParts = (mapData.objects ?? [])
      .filter(GrassCarpetLayout.#filter)
      .flatMap(GrassCarpetLayout.#flatMap);
    const sourceCovers = new Map(
      (mapData.riverData ?? []).flatMap(GrassCarpetLayout.#flatMap2),
    );
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const metadata = tileMeta?.[row]?.[col];
        const sourceHeight = sourceCovers.get(`${col},${row}`);
        const bridgeGroundHeight = metadata?.overpassId
          ? undefined
          : metadata?.bridgeGroundHeight;
        const surfaceHeight =
          sourceHeight ?? bridgeGroundHeight ?? heightmap[row][col];
        if (
          (grid[row][col] !== TileType.GRASS &&
            !metadata?.exposedTerrain &&
            sourceHeight === undefined &&
            !Number.isFinite(bridgeGroundHeight)) ||
          surfaceHeight <= 0 ||
          ["EARTH", "STONE"].includes(metadata?.surfaceType) ||
          metadata?.shape === TILE_SHAPE.SLOPE
        ) {
          continue;
        }
        const nearbyStones = stoneParts.filter(
          /**
           *
           * @param {{x: number, z: number}} options
           * @param {number} options.x
           * @param {number} options.z
           */
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
        // cliffs allow short tips, while paving keeps blades inside the lawn.
        const boundaryExtension = [
          [-1, 0],
          [0, -1],
          [1, 0],
          [0, 1],
        ].map(/**
         *
         * @param {{"\"0\"": number, "\"1\"": number}} options
         * @param {number} options."0"
         * @param {number} options."1"
         * @param {number} side
         */
          ([dx, dz], side) => {
            const neighborCol = col + dx;
            const neighborRow = row + dz;
            const neighborType = grid[neighborRow]?.[neighborCol];
            const neighborSource = sourceCovers.get(
              `${neighborCol},${neighborRow}`,
            );
            const neighborMeta = tileMeta?.[neighborRow]?.[neighborCol];
            const neighborBridgeGround = neighborMeta?.overpassId
              ? undefined
              : neighborMeta?.bridgeGroundHeight;
            const neighborHeight =
              neighborSource ??
            neighborBridgeGround ??
            heightmap[neighborRow]?.[neighborCol] ??
            0;
            // River banks still have exposed turf. Use a shorter fringe so tips
            // stay near the bank instead of spanning the channel.
            if (neighborType === TileType.WATER && neighborSource === undefined &&
            !Number.isFinite(neighborBridgeGround)) {
              if (neighborHeight < surfaceHeight - 0.01) {
                exposedSides |= 1 << side;

                return 0.1;
              }
              return 0;
            }
            if (neighborHeight < surfaceHeight - 0.01) {
              exposedSides |= 1 << side;

              return 0.14;
            }
            if (
              Math.abs(neighborHeight - surfaceHeight) > 0.01 ||
            neighborMeta?.shape === TILE_SHAPE.SLOPE ||
            neighborMeta?.renderMode === "BRIDGE"
            ) {
              return 0;
            }
            if (
              neighborType === TileType.GRASS ||
            neighborSource !== undefined ||
            Number.isFinite(neighborBridgeGround)
            ) {
              return 0.24;
            }
            // Blades over paving compete with the path surface at subpixel depth.
            return 0;
          });
        // A continuous sod lip per exposed side, with lawn blades above it.
        for (let side = 0; side < 4; side += 1) {
          if (!(exposedSides & (1 << side))) {
            continue;
          }
          const x = col - (cols - 1) / 2 + (side === 0 ? -0.49 : side === 2 ? 0.49 : 0);
          const z = row - (rows - 1) / 2 + (side === 1 ? -0.49 : side === 3 ? 0.49 : 0);
          let spans = [[-0.5, 0.5]];
          const acrossX = side === 1 || side === 3;
          for (const cut of metadata?.terrainCutouts ?? []) {
            if (surfaceHeight < cut.minY || surfaceHeight > cut.maxY) {
              continue;
            }
            const normal = acrossX ? z : x;
            const minNormal = acrossX ? cut.minZ : cut.minX;
            const maxNormal = acrossX ? cut.maxZ : cut.maxX;
            if (normal < minNormal - 0.05 || normal > maxNormal + 0.05) {
              continue;
            }
            const center = acrossX ? x : z;
            const start = (acrossX ? cut.minX : cut.minZ) - center - 0.02;
            const end = (acrossX ? cut.maxX : cut.maxZ) - center + 0.02;
            const remaining = [];
            for (const [low, high] of spans) {
              if (start >= high || end <= low) {
                remaining.push([low, high]);
              } else {
                if (start > low) {
                  remaining.push([low, start]);
                }
                if (end < high) {
                  remaining.push([end, high]);
                }
              }
            }
            spans = remaining;
          }
          for (const [low, high] of spans) {
            const midpoint = (low + high) / 2;
            const [lowSide, highSide] = [[1, 3], [2, 0], [3, 1], [0, 2]][side];
            placements.push({
              x: x + (acrossX ? midpoint : 0),
              y: surfaceHeight + GRASS_SURFACE_LIFT - 0.002,
              z: z + (acrossX ? 0 : midpoint),
              rotation: [270, 180, 90, 0][side],
              width: high - low,
              height: 1,
              fringe: true,
              broadleaf: false,
              exposedSides,
              boundaryExtension,
              edgeJoins: [
                Number(low === -0.5 && Boolean(exposedSides & (1 << lowSide))),
                Number(high === 0.5 && Boolean(exposedSides & (1 << highSide))),
              ],
              chunk: `${Math.floor(col / 6)},${Math.floor(row / 6)}`,
              detail: false,
              castleRearGrass: Boolean(castleRearGrass),
            });
          }
        }
        for (let index = 0; index < CLUMPS_PER_TILE; index += 1) {
          const seed =
            mapSeed ^ (col * 73856093) ^ (row * 19349663) ^ (index * 83492791);
          /**
           *
           * @param {number} salt
           */
          const random = (salt) => this.#random(seed ^ salt);
          const offsetX = (random(11) - 0.5) * 0.98;
          const offsetZ = (random(23) - 0.5) * 0.98;
          const broadleaf = random(89) < 0.045;
          const fineBlade = !broadleaf && random(97) < 0.28;
          let width = broadleaf
            ? 0.68 + random(53) * 0.22
            : fineBlade
              ? 0.32 + random(53) * 0.08
              : 0.5 + random(53) * 0.08;
          const x = col - (cols - 1) / 2 + offsetX;
          const z = row - (rows - 1) / 2 + offsetZ;
          let groundClearance = Infinity;
          for (const cut of metadata?.terrainCutouts ?? []) {
            if (surfaceHeight + 0.35 < cut.minY || surfaceHeight > cut.maxY) {
              continue;
            }
            const dx = Math.max(cut.minX - x, x - cut.maxX, 0);
            const dz = Math.max(cut.minZ - z, z - cut.maxZ, 0);
            groundClearance = Math.min(groundClearance, Math.hypot(dx, dz));
          }
          if (groundClearance < 0.08) {
            continue;
          }
          width = Math.min(width, groundClearance * 0.9);
          const stoneInfluence = nearbyStones.reduce(/**
           *
           * @param {number} strength
           * @param {{x: number, z: number, radius: number}} stone
           */
            (strength, stone) => {
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

  /**
   *
   * @param {number} seed
   */
  static #random(seed) {
    let value = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);

    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  /**
   *
   * @param {{object: string}} options
   * @param {string} options.object
   */
  static #filter({ object }) {
    return object === "StoneCluster";
  }

  /**
   *
   * @param {{position: {x: number, y: number, z: number}, parts: Array<{offsetX: number, offsetZ: number, diameter: number}>}} options
   * @param {{x: number, y: number, z: number}} options.position
   * @param {Array<{offsetX: number, offsetZ: number, diameter: number}>} options.parts
   */
  static #flatMap({ position, parts }) {
    return parts.map(/**
         *
         * @param {{offsetX: number, offsetZ: number, diameter: number}} options
         * @param {number} options.offsetX
         * @param {number} options.offsetZ
         * @param {number} options.diameter
         */
      ({ offsetX, offsetZ, diameter }) => ({
        x: position.x + offsetX,
        z: position.z + offsetZ,
        radius: diameter / 2,
      }));
  }

  /**
   *
   * @param {{cells: number}} options
   * @param {number} options.cells
   */
  static #flatMap2({ cells }) {
    return cells[0]
      ? [[`${cells[0].col},${cells[0].row}`, cells[0].terrainHeight]]
      : [];
  }
}

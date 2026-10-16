import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

import { SkyIslandScenery } from "../scenery/SkyIslandScenery.js";
import { MAP_TILE_TYPE } from "../../enum/MapTileType.js";

const MODEL_HEIGHT = 1.663;

const FACE_TRANSFORMS = {
  NORTH: {
    normalX: 0,
    normalZ: -1,
    tangentX: 1,
    tangentZ: 0,
    yaw: 180,
  },
  EAST: {
    normalX: 1,
    normalZ: 0,
    tangentX: 0,
    tangentZ: 1,
    yaw: 90,
  },
  SOUTH: {
    normalX: 0,
    normalZ: 1,
    tangentX: -1,
    tangentZ: 0,
    yaw: 0,
  },
  WEST: {
    normalX: -1,
    normalZ: 0,
    tangentX: 0,
    tangentZ: -1,
    yaw: -90,
  },
};

/**
 * Fit continuous authored trails to an exposed cliff, anchored at its grass lip.
 * @param {import("src/game/objects/ObjectTypes.js").GameMapData} mapData
 */
export function createCliffVineLayout(mapData) {
  const modules = [];
  const undersideFloors = new Map();
  if (mapData.grid) {
    for (const { col, row, level } of new SkyIslandScenery(mapData).createUndersideVoxels()) {
      const key = `${col},${row}`;
      undersideFloors.set(key, Math.min(undersideFloors.get(key) ?? 0, level));
    }
  }
  const vines = [...(mapData.cliffVineData ?? [])];
  const occupied = new Set(vines.map(
    /**
     * @param {{col: number, row: number, direction: string}} vine
     */
    (vine) => `${vine.col},${vine.row}:${vine.direction}`));
  const fillers = [];
  const riverCells = new Set();
  for (const river of mapData.riverData ?? []) {
    for (const { col, row } of river.cells) {
      riverCells.add(`${col},${row}`);
    }
  }
  for (const first of vines) {
    for (const second of vines) {
      const horizontal = first.direction === "NORTH" || first.direction === "SOUTH";
      if (first.direction !== second.direction ||
        (horizontal ? first.row !== second.row : first.col !== second.col)) {
        continue;
      }
      const start = horizontal ? first.col : first.row;
      const end = horizontal ? second.col : second.row;
      if (end <= start + 1) {
        continue;
      }
      const top = mapData.heightmap?.[first.row]?.[first.col];
      const face = FACE_TRANSFORMS[first.direction];
      if (!face || mapData.heightmap?.[second.row]?.[second.col] !== top) {
        continue;
      }
      const between = [];
      for (let position = start + 1; position < end; position++) {
        const col = horizontal ? position : first.col;
        const row = horizontal ? first.row : position;
        let clear = mapData.grid?.[row]?.[col] === MAP_TILE_TYPE.GRASS &&
          mapData.heightmap?.[row]?.[col] === top;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const type = mapData.grid?.[row + dr]?.[col + dc];
            if ([MAP_TILE_TYPE.PATH, MAP_TILE_TYPE.ENTRY, MAP_TILE_TYPE.CASTLE_WALL, MAP_TILE_TYPE.CASTLE_TOWER].includes(type)) {
              clear = false;
            }
          }
        }
        const neighbor = mapData.heightmap?.[row + face.normalZ]?.[col + face.normalX];
        if (!clear || neighbor >= top || riverCells.has(`${col},${row}`) || riverCells.has(`${col + face.normalX},${row + face.normalZ}`)) {
          between.length = 0; break;
        }
        between.push({
          ...first,
          col,
          row,
          offset: 0,
        });
      }
      for (const vine of between) {
        const key = `${vine.col},${vine.row}:${vine.direction}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          fillers.push(vine);
        }
      }
    }
  }
  for (const vine of [...vines, ...fillers]) {
    const face = FACE_TRANSFORMS[vine.direction];
    if (!face) {
      continue;
    }
    const topY = mapData.heightmap?.[vine.row]?.[vine.col] ?? vine.topY;
    const neighborRow = vine.row + face.normalZ;
    const neighborCol = vine.col + face.normalX;
    const neighborType = mapData.grid?.[neighborRow]?.[neighborCol];
    const outerFace = mapData.grid && (neighborType === undefined || neighborType === MAP_TILE_TYPE.WATER);
    const footY = outerFace
      ? undersideFloors.get(`${vine.col},${vine.row}`) ?? 0
      : mapData.heightmap?.[neighborRow]?.[neighborCol];
    if (!Number.isFinite(topY) || (Number.isFinite(footY) && footY >= topY)) {
      continue;
    }
    const faceHeight = topY - footY;
    const random = new GenerationRandom(`${mapData.mapName}:${vine.col}:${vine.row}:${vine.direction}:extension`);
    const extend = faceHeight > 2 || (faceHeight === 2 && random.rng(1, 100) <= 30);
    if (fillers.includes(vine) && !extend) {
      continue;
    }
    const bottomY = extend
      ? topY - faceHeight * random.rng(35, 75) / 100
      : Number.isFinite(footY) && faceHeight <= 1.25
        ? footY + 0.025
        : vine.bottomY;
    const length = topY - bottomY;
    if (!(length > 0)) {
      continue;
    }
    // Leave room for the crown and leaves at both ends of the solid tile face.
    const offset = Math.max(-0.12, Math.min(0.12, vine.offset));
    const centerX = vine.col - (mapData.cols - 1) / 2;
    const centerZ = vine.row - (mapData.rows - 1) / 2;
    modules.push({
      col: vine.col,
      row: vine.row,
      x: centerX + face.normalX * 0.502 + face.tangentX * offset,
      y: topY,
      z: centerZ + face.normalZ * 0.502 + face.tangentZ * offset,
      yaw: face.yaw,
      scaleX: vine.width / 0.16,
      scaleY: length / MODEL_HEIGHT,
      scaleZ: 1,
      topY,
      bottomY,
      moduleBottomY: bottomY,
    });
  }

  return modules;
}

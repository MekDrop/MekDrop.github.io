import { MAP_TILE_TYPE } from "../../enum/MapTileType.js";
import { COIN_TYPE } from "../../enum/CoinType.js";

/**
 * Assigns buried chest contents to complete surface cubes before rendering.
 */
export class BuriedTreasurePlacement {
  /**
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   * @param {() => number} random
   */
  static populate(mapData, random = Math.random) {
    const blocked = new Set();
    const trees = new Set();
    const cover = new Map();
    for (const definition of mapData.objects ?? []) {
      delete definition.buriedTreasure;
      if (!definition.tile) {
        continue;
      }
      const key = `${definition.tile.col},${definition.tile.row}`;
      if (definition.object === "Vegetation") {
        trees.add(key);
      } else if (!["Grass", "Earth"].includes(definition.object)) {
        blocked.add(key);
      }
    }
    for (const item of mapData.groundCoverData ?? []) {
      cover.set(`${item.col},${item.row}`, item.variant);
    }
    const seen = new Set();
    for (const cube of mapData.objects ?? []) {
      if (cube.object !== "Grass" || !cube.tile || !cube.position ||
          cube.geometry?.method !== "addCubeMatrix") {
        continue;
      }
      const { col, row } = cube.tile;
      const key = `${col},${row}`;
      const meta = mapData.tileMeta?.[row]?.[col];
      const height = mapData.heightmap?.[row]?.[col];
      if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 ||
          col >= mapData.cols || row >= mapData.rows || seen.has(key) || blocked.has(key) ||
          mapData.grid?.[row]?.[col] !== MAP_TILE_TYPE.GRASS ||
          (meta?.shape ?? "FLAT") !== "FLAT" || (meta?.renderMode ?? "SOLID") !== "SOLID" ||
          meta?.bridgeGroundHeight != null || meta?.overpassId || meta?.islandConnector ||
          !Number.isFinite(height) || cube.position.x !== col - (mapData.cols - 1) / 2 ||
          cube.position.z !== row - (mapData.rows - 1) / 2 ||
          cube.position.y !== height - 0.5) {
        continue;
      }
      seen.add(key);
      const variant = cover.get(key) ?? "";
      const flower = variant.includes("flower");
      const multiplier = trees.has(key) ? 3.5 : flower ? 5 : variant.includes("mushroom") ? 0.8 : 1;
      const chance = trees.has(key) ? 0.02 : flower ? 0.12 : 0.6;
      if (random() >= chance) {
        continue;
      }
      const amount = Math.round((5 + Math.floor(random() * 8)) * multiplier);
      const contents = Array.from({ length: amount }, () => {
        const roll = random() * 100;
        return roll < 12 ? COIN_TYPE.GOLD : roll < 42 ? COIN_TYPE.SILVER : COIN_TYPE.COPPER;
      });
      cube.buriedTreasure = { id: `buried-chest-${key}`, contents };
    }
  }
}

import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";

/**
 * Breaks exposed foundation lawns into broad, grid-aligned shallow terraces.
 */
export class CastleGroundWeathering {
  /**
   * @param {import("../../GameContracts.js").GameMapData} mapData
   * @param {Array<import("../ObjectTypes.js").MapObjectDefinition>} castles
   * @param {Array<import("./CastleGroundCuts.js").GroundCut>} cuts
   */
  static apply(mapData, castles, cuts) {
    const lowered = new Map();
    for (const castle of castles) {
      const position = castle.buildPlan.input.position;
      const target = Math.max(1, Math.ceil(position.elevation ?? 0) - 1);
      for (let row = 1; row < mapData.rows - 1; row += 1) {
        for (let col = 1; col < mapData.cols - 1; col += 1) {
          const x = col - (mapData.cols - 1) / 2;
          const z = row - (mapData.rows - 1) / 2;
          const metadata = mapData.tileMeta?.[row]?.[col];
          if (![TileType.GRASS, TileType.CASTLE_WALL, TileType.CASTLE_TOWER].includes(mapData.grid[row][col]) || !metadata?.exposedTerrain ||
            metadata.terrainCutouts?.length || metadata.overpassId || metadata.overpassPlateauId ||
            mapData.heightmap[row][col] !== target + 1) continue;
          if (x < position.x - 2 || x > position.x + position.width + 2 ||
            z < position.z - 2 || z > position.z + position.depth + 2) continue;
          // Leave a full level buffer around occupied masonry and every road lane.
          /**
           * @param {import("./CastleGroundCuts.js").GroundCut} cut
           */
          const overlapsProtectedGround = (cut) => x + 1.5 > cut.minX && x - 1.5 < cut.maxX &&
            z + 1.5 > cut.minZ && z - 1.5 < cut.maxZ;
          if (cuts.some(overlapsProtectedGround)) continue;
          let protectedTile = false;
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if ([TileType.PATH, TileType.ENTRY].includes(mapData.grid[row + dr][col + dc])) protectedTile = true;
            }
          }
          if (protectedTile) continue;
          // Overlapping low-frequency lobes make connected hollows, not pixel noise.
          const field = Math.sin((x - position.x) * 0.7 + 0.8) +
            Math.cos((z - position.z) * 0.85 - 0.4);
          if (field < 0.35) lowered.set(`${col},${row}`, target);
        }
      }
    }
    const candidates = new Set(lowered.keys());
    for (const key of candidates) {
      const [col, row] = key.split(",").map(Number);
      const neighbors = [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]];
      /**
       * @param {number[]} cell
       */
      const isWeatheringCandidate = (cell) => candidates.has(cell.join(","));
      if (!neighbors.some(isWeatheringCandidate)) lowered.delete(key);
    }
    mapData.objects = mapData.objects.filter(/**
     * @param {import("../ObjectTypes.js").MapObjectDefinition} record
     */
      (record) => {
        if (!record.generated || !record.tile || !["Earth", "Grass"].includes(record.object)) return true;
        const { col, row } = record.tile;
        const target = lowered.get(`${col},${row}`);
        if (target === undefined) return true;
        const halfHeight = record.geometry?.method === "addBoxMatrix" ? record.geometry.args[7] / 2 : 0.5;
        if (record.position.y + halfHeight > target + 0.000001) return false;
        if (Math.abs(record.position.y + halfHeight - target) < 0.000001) {
          record.object = "Grass";
          record.geometry.args[0] = `grass:${col}:${row}:${target - 1}`;
          record.geometry.args[1] = `turfSide:${col}:${row}:${target - 1}`;
          if (record.geometry.method === "addCubeMatrix") {
            record.geometry.args[5] = "full";
            record.geometry.args[7] = GRASS_SURFACE_LIFT;
          } else {
            record.geometry.args[9] = "full";
            record.geometry.args[12] = GRASS_SURFACE_LIFT;
          }
        }
        return true;
      });
    for (const [key, target] of lowered) {
      const [col, row] = key.split(",").map(Number);
      mapData.heightmap[row][col] = target;
      mapData.tileMeta[row][col] = {
        ...mapData.tileMeta[row][col],
        baseHeight: target,
        surfaceType: "GRASS",
        castleWeathered: true,
      };
    }
    for (const record of mapData.objects) {
      if (!["Vegetation", "StoneCluster"].includes(record.object) || !record.position) continue;
      const col = Math.round(record.position.x + (mapData.cols - 1) / 2);
      const row = Math.round(record.position.z + (mapData.rows - 1) / 2);
      if (lowered.has(`${col},${row}`)) record.position.y -= 1;
    }
  }
}

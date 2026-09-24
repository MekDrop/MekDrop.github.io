import { TileType } from "../../MapGenerator.js";
import { surfaceMaterialForTile } from "./TerrainMaterialMaps.js";
import { tileVariantIndex } from "./TileVariantIndex.js";

export class TerrainMaterialSelector {
  #grass;
  #earth;
  #sideVariantCount;

  constructor(grass, earth, sideVariantCount) {
    this.#grass = grass;
    this.#earth = earth;
    this.#sideVariantCount = sideVariantCount;
  }

  cubeMaterials(type, topCube, col, row, level) {
    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      if (!topCube) {
        return {
          top: "earth",
          sides: this.#earth.sideForTile(col, row, level),
          underlay: "earth",
        };
      }
      return {
        top: this.#grass.topForTile(col, row, level),
        sides: this.#earth.topSideForTile(col, row, level),
        underlay: "earth",
      };
    }
    if (!topCube) {
      return {
        top: "earth",
        sides: this.#earth.sideForTile(col, row, level),
        underlay: "earth",
      };
    }
    return {
      top:
        type === TileType.GRASS
          ? this.#grass.topForTile(col, row, level)
          : surfaceMaterialForTile(type, col, row, level),
      sides:
        type === TileType.GRASS
          ? this.#earth.topSideForTile(col, row, level)
          : this.#earth.sideForTile(col, row, level),
      underlay: type === TileType.WATER ? "water" : "earth",
    };
  }

  sideVariant(material, col, row, level) {
    if (material === "castleWall" || material === "castleTower") {
      return material;
    }
    const index = tileVariantIndex(col, row, level, 37, this.#sideVariantCount);
    return `${material}-${index}`;
  }
}
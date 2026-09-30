import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";

export const GRASS_SURFACE_TILES = new Set([TileType.GRASS]);

export const SURFACE_MATERIALS = {
  [TileType.GRASS]: "grass",
  [TileType.PATH]: "path",
  [TileType.WATER]: "water",
  [TileType.ENTRY]: "path",
};

export const SIDE_MATERIALS = {
  [TileType.GRASS]: "grassSide",
  [TileType.PATH]: "pathSide",
  [TileType.WATER]: "waterSide",
  [TileType.ENTRY]: "pathSide",
};

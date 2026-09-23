import { TileType } from "../../MapGenerator.js";

export const FIXED_HEIGHTS = {
  [TileType.WATER]: 0,
};

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

export const CUBE_SCALE = 1;
export const SURFACE_ELEVATION_BIAS = 0.0002;

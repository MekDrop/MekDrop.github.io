
/**
 * Shared generation dimensions, thresholds, and authored variation catalogs.
 */
export const YIELD_INTERVAL_MS = 8;
export const MAP_COLS = 42;
export const MAP_ROWS = 42;
export const DEFAULT_MIN_PATHS = 2;
export const DEFAULT_MAX_PATHS = 4;
export const LEFT_GATE_COL = 4;
export const RIGHT_GATE_COL = MAP_COLS - 1 - LEFT_GATE_COL;
export const PATH_HEIGHT = 2;
export const FOUNDATION_HEIGHT = 3;
export const WATER_HEIGHT = 0;
export const MAX_RIVERS = 6;
export const MIN_RIVER_TILES = 7;
export const RIVER_SURFACE_INSET = 0.5;
export const LAVA_SURFACE_INSET = 0.22;
export const RIVER_WATER_DEPTH = 0.5;
export const BRIDGE_WATER_CLEARANCE = 0.52;
export const RIVER_CASTLE_SETBACK = 6;
export const TERMINAL_WATERFALL_BOTTOM = -10.5;
export const RIVER_COUNT_WEIGHTS = [15, 35, 22, 13, 8, 5, 2];
export const LAVA_ISLAND_CHANCE = 10;
export const MAX_LAVA_ELIGIBLE_RIVERS = 2;
export const CASTLE_GROUND_CLEARANCE = 3;
export const CASTLE_REAR_GROUND_CLEARANCE = 1;
export const OVERPASS_CHANCE_BY_PATH_COUNT = [0, 0, 10, 28, 46];
export const OVERPASS_ELEVATION = PATH_HEIGHT + 2;
export const OVERPASS_RAMP_TILES = 4;
export const OVERPASS_HALF_STEP = 0.5;
export const OVERPASS_DECK_THICKNESS = 0.24;
export const OVERPASS_MIN_CLEARANCE = 1.6;
export const OVERPASS_RAISED_ENTRY_CHANCE = 60;
export const OVERPASS_STAIR_APPROACH_CHANCE = 40;
export const OVERPASS_PLATEAU_RADIUS = 3;
export const MIN_ARROW_GATE_CLEARANCE = 0.5;
export const MIN_ARROW_CASTLE_CLEARANCE = 4;
export const TERRAIN_BRIDGE_DIP_CHANCE = 60;
export const TERRAIN_BRIDGE_DIP_ELEVATION = PATH_HEIGHT - 1;
export const TERRAIN_BRIDGE_DIP_RAMP_TILES = 2;
export const TERRAIN_BRIDGE_DIP_MIN_SPAN = TERRAIN_BRIDGE_DIP_RAMP_TILES * 2 + 1;
export const STONE_LEVEL_WEIGHTS = [72, 23, 5];
export const TREE_VARIANTS = ["oak", "pine", "tall-tree", "sapling"];
export const BUSH_VARIANTS = ["round-bush", "wide-bush"];
export const GROUND_COVER_VARIANTS = [
  "daisy-patch",
  "buttercup-patch",
  "pink-flower-patch",
  "blue-flower-patch",
  "clover-patch",
  "red-mushroom",
  "golden-mushroom-pair",
  "forest-mushroom-cluster",
];
export const FLOWER_PATCH_VARIANTS = [
  "daisy-patch",
  "buttercup-patch",
  "pink-flower-patch",
  "blue-flower-patch",
  "clover-patch",
];
export const MUSHROOM_PATCH_VARIANTS = [
  "red-mushroom",
  "golden-mushroom-pair",
  "forest-mushroom-cluster",
];
export const VEGETATION_VARIANTS = [
  ...TREE_VARIANTS,
  ...BUSH_VARIANTS,
];
export const CASTLE_FOOTPRINTS = [
  { width: 16, depth: 28, style: "twin-tower", entranceFraction: 0.48 },
  { width: 16, depth: 28, style: "right-angle", entranceFraction: 0.43 },
  { width: 16, depth: 28, style: "single-tower", entranceFraction: 0.22 },
  { width: 16, depth: 28, style: "left-angle", entranceFraction: 0.22 },
];
export const ENTRY_TEMPLATES = [
  { id: "north", gateRows: [5, 6], mergeRange: [18, 24] },
  { id: "upper", gateRows: [10, 11], mergeRange: [14, 20] },
  { id: "lower", gateRows: [19, 20], mergeRange: [11, 18] },
  { id: "south", gateRows: [25, 26], mergeRange: [13, 20] },
];

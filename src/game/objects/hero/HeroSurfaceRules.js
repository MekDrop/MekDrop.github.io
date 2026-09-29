import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";

// Shared geometric policy for terrain queries, boot support and Hero physics.
export const MAX_SAFE_STEP_DOWN = 1 + GRASS_SURFACE_LIFT;
export const STEP_CLEARANCE = 0.32;
// Matches the widest part of the hero below one terrain level. The circle is
// still slightly narrower than a tile, leaving room to slide along ledges.
export const HERO_RADIUS = 0.46;
export const HERO_COLLISION_HEIGHT = 1.45;
// Terrain and scenery clearance follows the hero's planted lower body. Wider
// arm and shoulder poses are visual only and must not close valid footpaths.
export const MOVEMENT_COLLISION_RADIUS = 0.18;
// Raised terrain must also clear the torso around exposed corners. This stays
// below half a tile so a one-tile corridor remains traversable.
export const TERRAIN_BODY_COLLISION_RADIUS = 0.4;
export const MOVEMENT_FORWARD_COLLISION_OFFSET =
  HERO_RADIUS - MOVEMENT_COLLISION_RADIUS;
// BlockedPush leans the upper body forward beyond the standing footprint.
// Reserve that depth and head width only in front of raised terrain; keeping
// the probe below half a tile leaves one-tile corridors open.
export const TERRAIN_FORWARD_COLLISION_OFFSET = 0.48;
export const TERRAIN_FORWARD_COLLISION_RADIUS = 0.36;
export const COLLISION_DISTANCE_EPSILON = 0.000001;
// Ledge checks follow the hero's planted feet instead of the widest parts of
// the model. This lets the hero approach a drop before refusing to step off.
export const LEDGE_RADIUS = 0.27;
export const FOOT_FORWARD_OFFSET = 0.1;
export const FOOT_LATERAL_OFFSET = 0.13;
// Slightly inset from the authored boot sole (0.19 x 0.12 at game scale) so
// tiny visual corner overhangs remain usable while half-sole overhangs do not.
export const FOOT_HALF_LENGTH = 0.18;
export const FOOT_HALF_WIDTH = 0.11;
export const FOOT_REQUIRED_PERIMETER_SUPPORTS = 5;
export const LANDING_BACKTRACK_STEP = 0.025;
export const LANDING_FORWARD_SETTLE_DISTANCE =
  FOOT_FORWARD_OFFSET + FOOT_HALF_LENGTH;
// Castle foundation cells remain traversable dirt. The castle collision world
// owns the exact wall, door, stair, and furniture footprints, so the whole
// foundation rectangle must not behave like one solid wall.
export const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.ENTRY,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
export const GRASS_SURFACE_TILES = new Set([TileType.GRASS]);
// Only castle floor and stair surfaces may replace the terrain height beneath
// their footprint. Vegetation surfaces can overlap a neighbouring terrain
// tile, but must never make that tile's cliff face traversable.
export const STRUCTURE_SURFACE_TILES = new Set([
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);

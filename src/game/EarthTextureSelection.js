import { EARTH_TEXTURE_VARIANT_COUNT, MAX_UNDERSIDE_DEPTH } from "./config/terrain.js";

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

function variantForBlock(seed, col, row, level) {
  let hash = seed;
  hash = Math.imul(hash ^ Math.imul(col + 1, 73856093), 16777619);
  hash = Math.imul(hash ^ Math.imul(row + 1, 19349663), 16777619);
  hash = Math.imul(hash ^ Math.imul(level + MAX_UNDERSIDE_DEPTH + 1, 83492791), 16777619);
  return (hash >>> 0) % EARTH_TEXTURE_VARIANT_COUNT;
}

export function createEarthTextureVariants(mapData) {
  const firstLevel = -MAX_UNDERSIDE_DEPTH;
  const highestTerrain = Math.max(
    1,
    ...mapData.heightmap.flat().map((height) => Math.ceil(height)),
    Math.ceil(mapData.overpassData?.deckElevation ?? 0),
  );
  const seed = hashString(mapData.mapName ?? mapData.layoutSignature ?? "earth");
  const tiles = Array.from({ length: mapData.rows }, (_, row) =>
    Array.from({ length: mapData.cols }, (_, col) =>
      Array.from(
        { length: highestTerrain - firstLevel + 1 },
        (_, index) => variantForBlock(seed, col, row, firstLevel + index),
      ),
    ),
  );
  return { firstLevel, tiles };
}
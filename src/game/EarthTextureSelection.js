import { EARTH_TEXTURE_VARIANT_COUNT, MAX_UNDERSIDE_DEPTH } from "./config/terrain.js";

/**
 *
 * @param {number} value
 */
function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

/**
 *
 * @param {number} seed
 * @param {number} col
 * @param {number} row
 * @param {number} level
 */
function variantForBlock(seed, col, row, level) {
  let hash = seed;
  hash = Math.imul(hash ^ Math.imul(col + 1, 73856093), 16777619);
  hash = Math.imul(hash ^ Math.imul(row + 1, 19349663), 16777619);
  hash = Math.imul(hash ^ Math.imul(level + MAX_UNDERSIDE_DEPTH + 1, 83492791), 16777619);
  return (hash >>> 0) % EARTH_TEXTURE_VARIANT_COUNT;
}

/**
 *
 * @param {import("src/game/GameContracts.js").GameMapData} mapData
 */
export function createEarthTextureVariants(mapData) {
  const firstLevel = -MAX_UNDERSIDE_DEPTH;
  const highestTerrain = Math.max(
    1,
    ...mapData.heightmap.flat().map(/**
     *
     * @param {number} height
     */
    (height) => Math.ceil(height)),
    Math.ceil(mapData.overpassData?.deckElevation ?? 0),
  );
  const seed = hashString(mapData.mapName ?? mapData.layoutSignature ?? "earth");
  const tiles = Array.from({ length: mapData.rows }, /**
   *
   * @param {undefined} _
   * @param {number} row
   */
  (_, row) =>
    Array.from({ length: mapData.cols }, /**
     *
     * @param {undefined} _
     * @param {number} col
     */
    (_, col) =>
      Array.from(
        { length: highestTerrain - firstLevel + 1 },
        /**
         *
         * @param {undefined} _
         * @param {number} index
         */
        (_, index) => variantForBlock(seed, col, row, firstLevel + index),
      ),
    ),
  );
  return { firstLevel, tiles };
}
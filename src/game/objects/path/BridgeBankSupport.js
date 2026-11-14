/**
 * Check both lanes for solid terrain close enough to hold a bridge anchor.
 * @param {import("../../GameContracts.js").GameMapData} map
 * @param {import("./BridgeRailingKit.js").BridgeSpan} span
 * @param {number} elevation
 * @param {number} station
 * @param {number[]} offsets
 * @returns {boolean}
 */
export function hasBridgeBankSupport(map, span, elevation, station, offsets = [0, 0]) {
  const lanes = [Math.floor(span.crossCenter), Math.ceil(span.crossCenter)];
  for (let index = 0; index < lanes.length; index++) {
    const across = lanes[index];
    const col = span.horizontal ? station : across;
    const row = span.horizontal ? across : station;
    const tile = map.grid[row]?.[col];
    const height = map.heightmap[row]?.[col];
    const metadata = map.tileMeta[row]?.[col];
    // The pinned joint sits 0.13 below deck height; a lower bank must reach it.
    if (!tile || !Number.isFinite(height) || Math.abs(height + offsets[index] - elevation) > 0.12
      || metadata?.bridgeCollapsed || metadata?.bridgeCollapsing || metadata?.overpassCollapsed) {
      return false;
    }
  }

  return true;
}

import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";

/**
 * Shared bridge shape for artwork, feet, and the terrain physics mesh.
 * The shallow arch is linear within each station so collision and timber agree.
 */
export class BridgeProfile {
  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @param {import("../../GameContracts.js").GameMapData} map
   * @returns {number}
   */
  static anchorDirection(definition, map) {
    const { span } = definition;
    const first = span.cells[0];
    const owner = new IslandCellOwnership(map).groups.find(/**
     * @param {Set<string>} cells
     */
      (cells) => cells.has(`${first.col},${first.row}`));
    const across = Math.floor(span.crossCenter);
    const before = span.horizontal ? `${span.start - 1},${across}` : `${across},${span.start - 1}`;
    const after = span.horizontal ? `${span.end + 1},${across}` : `${across},${span.end + 1}`;

    return owner?.has(after) && !owner.has(before) ? -1 : 1;
  }

  /**
   * Continuous rails protect the anchored section and leave the docking tip open.
   * @param {import("./BridgeRailingKit.js").BridgeSpan} span
   * @param {number} station
   * @param {boolean} floating
   * @param {number} anchorDirection
   * @returns {{start: number, end: number, endPost: boolean}|null}
   */
  static railRange(span, station, floating, anchorDirection = 1) {
    const reach = span.length === 1 ? 0.56 : span.length * 0.6;
    const lower = floating && anchorDirection < 0 ? span.end + 0.5 - reach : span.start - 0.34;
    const upper = floating && anchorDirection > 0 ? span.start - 0.5 + reach : span.end + 0.34;
    const start = Math.max(-0.5, lower - station);
    const end = Math.min(0.5, upper - station);

    return end - start > 0.02 ? {
      start,
      end,
      endPost: station + 0.5 >= upper,
    } : null;
  }
  /**
   * Only spans crossing an island connector float; ordinary river bridges on
   * those same islands keep their bank-supported arch.
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @param {import("../../GameContracts.js").GameMapData} map
   * @returns {boolean}
   */
  static isFloating(definition, map) {
    const cells = new Set((map.islandConnectorData?.cells ?? []).map(BridgeProfile.#cellKey));

    return definition.span.cells.some(/**
     * @param {import("../ObjectTypes.js").GridPoint} cell
     */
      (cell) => cells.has(BridgeProfile.#cellKey(cell)));
  }

  /**
   * @param {import("../ObjectTypes.js").GridPoint} cell
   * @returns {string}
   */
  static #cellKey(cell) {
    return `${cell.col},${cell.row}`;
  }

  /**
   * @param {import("./BridgeRailingKit.js").BridgeSpan} span
   * @param {number} along Grid coordinate along the deck.
   * @returns {number}
   */
  static rise(span, along) {
    const length = span.end - span.start + 1;
    const distance = Math.max(0, Math.min(length, along - span.start + 0.5));
    const station = Math.min(length - 1, Math.floor(distance));
    const fraction = distance - station;
    const amplitude = Math.min(0.32, length * 0.055);
    const before = station / length;
    const after = (station + 1) / length;

    return amplitude * 4 * (before * (1 - before) * (1 - fraction) + after * (1 - after) * fraction);
  }

  /**
   * Publish the same profile to terrain collision and every character's support
   * sampler before the scene is built. Do not change the authored heightmap.
   * @param {import("../../GameContracts.js").GameMapData} map
   */
  static prepare(map) {
    for (const definition of map.objects ?? []) {
      if (definition.object !== "Bridge") {
        continue;
      }
      const floating = BridgeProfile.isFloating(definition, map);
      for (const cell of definition.span.cells) {
        const metadata = map.tileMeta?.[cell.row]?.[cell.col];
        if (metadata) {
          metadata.bridgeProfile = {
            horizontal: definition.span.horizontal,
            start: definition.span.start,
            end: definition.span.end,
            elevation: definition.elevation,
            floating,
          };
        }
      }
    }
  }

  /**
   * @param {{horizontal: boolean, start: number, end: number, elevation: number, floating: boolean}} profile
   * @param {number} col Continuous grid coordinate.
   * @param {number} row Continuous grid coordinate.
   * @returns {number}
   */
  static heightAt(profile, col, row) {
    return profile.elevation + (profile.floating ? 0 : BridgeProfile.rise(profile, profile.horizontal ? col : row));
  }
}

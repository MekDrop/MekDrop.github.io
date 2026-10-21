import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";

const NEAR_PERIOD = 5.3;
const FAR_PERIOD = 7.7;
const NEAR_AMPLITUDE = 0.065;
const FAR_AMPLITUDE = 0.045;

/**
 * Gentle visual bobbing with a distinct period for every island section.
 */
export class IslandConnectorMotion {
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {Set<string>[]}
   */
  #groups = [];
  /**
   * @type {number}
   */
  #anchor = -1;
  /**
   * @type {number}
   */
  #cols = 0;
  /**
   * @type {number}
   */
  #rows = 0;

  /**
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  constructor(mapData) {
    if (mapData) {
      this.#groups = new IslandCellOwnership(mapData).groups;
      this.#cols = mapData.cols;
      this.#rows = mapData.rows;
    }
  }

  /**
   * @param {number} count
   * @param {number} deltaTime
   * @param {number} zoom
   * @param {import("playcanvas").Vec2} focus
   */
  update(deltaTime, count = 2, zoom = 1, focus = null) {
    this.#elapsed += deltaTime;
    const groups = Array.from({ length: count }, this.#from.bind(this));
    if (focus) {
      const col = Math.round(focus.x + (this.#cols - 1) / 2);
      const row = Math.round(focus.y + (this.#rows - 1) / 2);
      const key = col + "," + row;
      const anchor = this.#groups.findIndex(/**
       *
       * @param {Set<string>} cells
       */
        (cells) => cells.has(key));
      if (anchor >= 0) {
        this.#anchor = anchor;
      }
    }
    // At close range, observe from the focused island's moving reference frame.
    // Subtracting one common offset preserves every island's relative motion.
    const progress = Math.max(0, Math.min(1, (zoom - 1.25) / 1.25));
    const grounding = progress * progress * (3 - 2 * progress);
    const reference = (groups[this.#anchor] ?? 0) * grounding;
    const relativeGroups = groups.map(/**
     *
     * @param {number} offset
     */
      (offset) => offset - reference);

    return {
      groups: relativeGroups,
      near: Math.sin(this.#elapsed * Math.PI * 2 / NEAR_PERIOD) * NEAR_AMPLITUDE - reference,
      far: Math.sin(this.#elapsed * Math.PI * 2 / FAR_PERIOD) * FAR_AMPLITUDE - reference,
    };
  }

  /**
   *
   * @param {number} value
   * @param {number} index
   */
  #from(value, index) {
    const period = index === 0 ? NEAR_PERIOD : FAR_PERIOD + (index - 1) * 2.4;
    const amplitude = index === 0 ? NEAR_AMPLITUDE : FAR_AMPLITUDE;

    return Math.sin(this.#elapsed * Math.PI * 2 / period) * amplitude;
  }
}

import { State } from "yuka";

/**
 * Base state for a hero emotion with state-local intensity levels.
 * @abstract
 */
export class AbstractHeroEmotionState extends State {
  /**
   *
    * @type {string}
   */
  #emotion;
  /**
   *
    * @type {number}
   */
  #minimumPressure;
  /**
   *
    * @type {number}
   */
  #levelCount;
  /**
   *
    * @type {Array<number>}
   */
  #tracksPressureLevels;
  /**
   *
    * @type {number}
   */
  #pressure = 0;
  /**
   *
    * @type {number}
   */
  #level = 0;

  /**
   *
   * @param {string} emotion
   * @param {number} minimumPressure
   * @param {number} levelCount
   * @param {{tracksPressureLevels: Array<number>}} options
   * @param {Array<number>} options.tracksPressureLevels
   */
  constructor(
    emotion,
    minimumPressure,
    levelCount,
    { tracksPressureLevels = true } = {},
  ) {
    super();
    this.#emotion = emotion;
    this.#minimumPressure = minimumPressure;
    this.#levelCount = levelCount;
    this.#tracksPressureLevels = tracksPressureLevels;
  }

  get emotion() {
    return this.#emotion;
  }

  get pressure() {
    return this.#pressure;
  }

  set pressure(value) {
    this.#pressure = Number.isFinite(value) ? Math.max(0, value) : 0;
    if (!this.#tracksPressureLevels) {
      return;
    }
    this.#level = Math.max(
      1,
      Math.min(
        this.#levelCount,
        Math.floor(this.#pressure - this.#minimumPressure) + 1,
      ),
    );
  }

  get level() {
    return this.#level;
  }

  /**
   *
    * @returns {boolean}
   */
  get acceptsActions() {
    return true;
  }

  resetLevel() {
    this.#level = 1;
  }

  increaseLevel() {
    this.#level = Math.min(this.#levelCount, Math.max(1, this.#level + 1));
  }

  /**
   *
   * @param {number} level
   */
  setLevel(level) {
    if (!Number.isFinite(level)) {
      return;
    }
    this.#level = Math.min(this.#levelCount, Math.max(1, Math.floor(level)));
  }
}

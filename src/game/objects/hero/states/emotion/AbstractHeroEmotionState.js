import { State } from "yuka";

/**
 * Base state for a hero emotion with state-local intensity levels.
 * @abstract
 */
export class AbstractHeroEmotionState extends State {
  #emotion;
  #minimumPressure;
  #levelCount;
  #tracksPressureLevels;
  #pressure = 0;
  #level = 0;

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

  get acceptsActions() {
    return true;
  }

  resetLevel() {
    this.#level = 1;
  }

  increaseLevel() {
    this.#level = Math.min(this.#levelCount, Math.max(1, this.#level + 1));
  }

  setLevel(level) {
    if (!Number.isFinite(level)) {
      return;
    }
    this.#level = Math.min(this.#levelCount, Math.max(1, Math.floor(level)));
  }
}

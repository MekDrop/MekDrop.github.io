import {
  getCurrentAmbientWindSpeed,
  resetAmbientWindSpeed,
  setAmbientWindSpeed,
} from "../objects/shared/AmbientWind.js";

const MINIMUM_WIND_SPEED = 0;

export class SetWindSpeedCommand {
  /**
   *
   * @type {Console}
   */
  #logger;

  /**
   *
   * @param {Pick<Console, "debug"|"info"|"warn"|"error">} logger
   */
  constructor(logger = console) {
    /**
     *
     * @type {Console}
     */
    this.#logger = logger;
  }

  /**
   *
   * @returns {string}
   */
  get name() {
    return "setWindSpeed";
  }

  /**
   *
   * @returns {string}
   */
  get usage() {
    return 'setWindSpeed(speed | "auto")';
  }

  /**
   *
   * @returns {string}
   */
  get description() {
    return "Sets any non-negative wind speed, or resumes automatic gusts.";
  }

  /**
   *
   * @param {number} speed
   */
  execute(speed) {
    if (speed === "auto") {
      resetAmbientWindSpeed();
      return getCurrentAmbientWindSpeed();
    }
    if (
      typeof speed !== "number" ||
      !Number.isFinite(speed) ||
      speed < MINIMUM_WIND_SPEED
    ) {
      this.#logger.warn(
        'setWindSpeed(speed) expects a non-negative number, or "auto".',
      );
      return null;
    }
    setAmbientWindSpeed(speed);
    return speed;
  }
}

import {
  getCurrentAmbientWindSpeed,
  resetAmbientWindSpeed,
  setAmbientWindSpeed,
} from "../objects/shared/AmbientWind.js";

const MINIMUM_WIND_SPEED = 0;

export class SetWindSpeedCommand {
  #logger;

  constructor(logger = console) {
    this.#logger = logger;
  }

  get name() {
    return "setWindSpeed";
  }

  get usage() {
    return 'setWindSpeed(speed | "auto")';
  }

  get description() {
    return "Sets any non-negative wind speed, or resumes automatic gusts.";
  }

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

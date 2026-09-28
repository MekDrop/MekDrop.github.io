import { getCurrentAmbientWindSpeed } from "../objects/shared/AmbientWind.js";

export class GetWindSpeedCommand {
  /**
   *
   * @returns {string}
   */
  get name() {
    return "getWindSpeed";
  }

  /**
   *
   * @returns {string}
   */
  get usage() {
    return "getWindSpeed()";
  }

  /**
   *
   * @returns {string}
   */
  get description() {
    return "Returns the current world wind speed.";
  }

  execute() {
    return getCurrentAmbientWindSpeed();
  }
}

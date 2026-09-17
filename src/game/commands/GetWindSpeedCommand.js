import { getCurrentAmbientWindSpeed } from "../objects/shared/AmbientWind.js";

export class GetWindSpeedCommand {
  get name() {
    return "getWindSpeed";
  }

  get usage() {
    return "getWindSpeed()";
  }

  get description() {
    return "Returns the current world wind speed.";
  }

  execute() {
    return getCurrentAmbientWindSpeed();
  }
}

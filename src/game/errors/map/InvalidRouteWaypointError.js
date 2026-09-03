export class InvalidRouteWaypointError extends Error {
  constructor() {
    super("Map routing failed: route waypoint is invalid.");
    this.name = this.constructor.name;
  }
}

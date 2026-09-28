export class InvalidRouteWaypointError extends Error {
  constructor() {
    super("Map routing failed: route waypoint is invalid.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}

export class NonOrthogonalRouteSegmentError extends Error {
  constructor() {
    super("Map routing failed: route segment is not orthogonal.");
    this.name = this.constructor.name;
  }
}

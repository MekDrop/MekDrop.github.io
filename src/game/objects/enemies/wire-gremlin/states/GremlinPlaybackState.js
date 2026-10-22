import { State } from "yuka";

/**
 * Suspends behavior during explicit test-map clip inspection.
 */
export class GremlinPlaybackState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.releaseTarget();
    owner.stop();
  }
}

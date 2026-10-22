import { State } from "yuka";

/**
 * Wire Gremlin's climb start behavior.
 */
export class GremlinClimbState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("climb_start");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.climb();
  }
}

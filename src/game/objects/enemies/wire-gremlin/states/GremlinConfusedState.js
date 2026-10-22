import { State } from "yuka";

/**
 * Wire Gremlin's confused behavior.
 */
export class GremlinConfusedState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("confused");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.waitForClarity();
  }
}

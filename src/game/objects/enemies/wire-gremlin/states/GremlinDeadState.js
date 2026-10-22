import { State } from "yuka";

/**
 * Wire Gremlin's death behavior.
 */
export class GremlinDeadState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("death");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 1.5) {
      owner.destroy();
    }
  }
}

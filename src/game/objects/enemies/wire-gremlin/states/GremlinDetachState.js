import { State } from "yuka";

/**
 * Restore the tower immediately, then finish the authored exit before release.
 */
export class GremlinDetachState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("sabotage_end");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed < 0.4) {
      return;
    }
    owner.playAnimation("detach");
    if (owner.stateElapsed >= 0.4 + 14 / 30) {
      owner.finishDetaching();
    }
  }
}

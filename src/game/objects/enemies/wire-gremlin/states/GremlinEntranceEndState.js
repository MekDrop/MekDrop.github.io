import { State } from "yuka";

/**
 * Finish the mechanism action before starting the doorway crossing.
 */
export class GremlinEntranceEndState extends State {
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
    if (owner.stateElapsed >= 0.4) {
      owner.changeState("GremlinPursueState");
    }
  }
}

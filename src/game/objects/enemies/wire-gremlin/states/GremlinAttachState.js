import { State } from "yuka";

/**
 * Finish fastening before the separate sabotage windup begins.
 */
export class GremlinAttachState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("attach_tower");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 0.4) {
      owner.changeState("GremlinSabotageState");
    }
  }
}

import { State } from "yuka";

/**
 * Wire Gremlin's angry behavior.
 */
export class GremlinAngryState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("angry");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 0.65) {
      owner.changeState("GremlinPursueState");
    }
  }
}

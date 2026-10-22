import { State } from "yuka";

/**
 * Wire Gremlin's run behavior.
 */
export class GremlinPursueState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("run");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.pursue();
  }
}

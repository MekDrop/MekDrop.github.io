import { State } from "yuka";

/**
 * Complete authored recovery before resuming the interrupted task.
 */
export class GremlinRecoveryState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("recover");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 0.5) {
      owner.resumeTask();
    }
  }
}

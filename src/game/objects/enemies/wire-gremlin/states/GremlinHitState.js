import { State } from "yuka";

/**
 * Brief grounded hit reaction, with sabotage suspended at impact.
 */
export class GremlinHitState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("hit");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 0.3) {
      owner.resumeTask();
    }
  }
}

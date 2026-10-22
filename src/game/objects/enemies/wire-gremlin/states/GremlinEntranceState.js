import { State } from "yuka";

/**
 * Pliers defeat the entrance mechanism before resuming the royal pursuit.
 */
export class GremlinEntranceState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("sabotage_start");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.sabotageEntrance();
  }
}

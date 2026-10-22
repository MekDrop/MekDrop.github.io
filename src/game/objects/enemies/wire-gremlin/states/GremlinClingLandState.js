import { State } from "yuka";

/**
 * Absorb a successful tower impact before fastening the tool grip.
 */
export class GremlinClingLandState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("cling_land");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 1 / 3) {
      owner.changeState("GremlinAttachState");
    }
  }
}

import { State } from "yuka";

/**
 * External stun pauses work independently of bell confusion.
 */
export class GremlinStunnedState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("stun");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.waitForClarity();
  }
}

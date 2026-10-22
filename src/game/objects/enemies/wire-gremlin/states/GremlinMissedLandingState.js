import { State } from "yuka";

/**
 * Wire Gremlin's missed land stun behavior.
 */
export class GremlinMissedLandingState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("missed_land_stun");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 0.8) {
      owner.changeState("GremlinAngryState");
    }
  }
}

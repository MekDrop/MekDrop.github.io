import { State } from "yuka";

/**
 * Wire Gremlin's sabotage start behavior.
 */
export class GremlinSabotageState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("sabotage_start");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.sabotage();
  }
}

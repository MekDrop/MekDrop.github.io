import { State } from "yuka";

/**
 * Wire Gremlin's pliers attack behavior.
 */
export class GremlinAttackState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("pliers_attack");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.attack();
  }
}

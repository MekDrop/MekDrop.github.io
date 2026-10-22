import { State } from "yuka";

/**
 * Wire Gremlin's territorial warn behavior.
 */
export class GremlinTerritorialState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("territorial_warn");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.dispute();
  }
}

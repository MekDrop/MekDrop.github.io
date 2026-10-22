import { State } from "yuka";

/**
 * Wire Gremlin's carried ready behavior.
 */
export class GremlinCarriedState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("carried_ready");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    // Carry and flight transforms belong to the shared Enemy and Ammo.
  }
}

import { State } from "yuka";

/**
 * Wire Gremlin's airborne reach behavior.
 */
export class GremlinAirborneState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playAnimation("airborne_reach");
    owner.stop();
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    // Carry and flight transforms belong to the shared Enemy and Ammo.
  }
}

import { State } from "yuka";

/**
 * Territorial pliers strike with separate windup, one contact and recovery.
 */
export class GremlinTerritorialAttackState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.attackContact = false;
    owner.stop();
    owner.playAnimation("pliers_attack");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    owner.territorialAttack();
  }
}

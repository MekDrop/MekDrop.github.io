import { State } from "yuka";

/**
 * Cinder Imp's Pursue behavior.
 */
export class CinderPursueState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.playClip("idle");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    if (!owner.alive || owner.carrier || owner.airborne) {
      return;
    }
    if (owner.statuses.has("stun")) {
      owner.transition("CinderStunState");

      return;
    }
    const target = owner.chooseTarget();
    if (!target) {
      owner.stop(); owner.playClip("idle");

      return;
    }
    const waypoint = owner.navigation.next(target) ?? target;
    const obstruction = owner.findObstruction(waypoint);
    owner.attackTarget = obstruction ?? target;
    if (owner.elapsed >= owner.nextFire && owner.canReachWithFire(owner.attackTarget)) {
      owner.transition(owner.isFrostActor(owner.attackTarget) ? "CinderRivalAttackState" : "CinderFireWindupState");

      return;
    }
    owner.playClip(owner.moveToward(obstruction ?? waypoint, owner.walkSpeed, waypoint === target ? 0.05 : 0.001) ? "walk" : "idle");
  }

}

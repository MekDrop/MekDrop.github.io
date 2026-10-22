import { State } from "yuka";
import { GobblerBiteState } from "./GobblerBiteState.js";

export class GobblerPursueState extends State {
  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    const target = owner.findFood() ?? owner.resolveRoyalTarget();
    if (!target) {
      owner.stop();
      owner.requestClip("idle");

      return;
    }
    if (owner.distanceTo(target) <= 0.85 && owner.navigation.canReach(target)) {
      owner.biteTarget = target;
      owner.behavior.changeTo(GobblerBiteState.name);

      return;
    }
    owner.requestClip(owner.sleepy ? "sleepy_walk" : "waddle_walk");
    owner.navigation.pursue(target);
  }
}

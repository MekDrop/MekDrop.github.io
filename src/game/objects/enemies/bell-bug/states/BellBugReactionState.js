import { State } from "yuka";
import { BellBugPursueState } from "./BellBugPursueState.js";

/**
 * Shared interruption state; carrier and flight lifecycles remain Ammo-owned.
 */
export class BellBugReactionState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip(owner.reactionClip);
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (!owner.alive) {
      if (owner.phaseTime >= 1.2) {
        owner.destroy();
      }
      return;
    }
    if (owner.carrier || owner.airborne) {
      return;
    }
    if (owner.statuses.has("stun") || owner.statuses.has("confused")) {
      owner.stop();

      return;
    }
    owner.playClip(owner.reactionClip === "land" ? "land_recover" : "recover");
    if (owner.phaseTime >= 0.6) {
      owner.transition(BellBugPursueState.name);
    }
  }
}

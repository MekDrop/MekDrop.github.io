import { State } from "yuka";
import { BellBugPanicState } from "./BellBugPanicState.js";
import { BellBugScratchState } from "./BellBugScratchState.js";

/**
 * Royal pursuit, with closed main doors as temporary obstacles.
 */
export class BellBugPursueState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.playClip("idle_nervous");
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    if (owner.fearEvent) {
      owner.transition(BellBugPanicState.name);

      return;
    }
    if (owner.scoop.target) {
      owner.stop();

      return;
    }
    if (owner.scoop.approachTarget) {
      owner.scoop.approach();

      return;
    }
    if (owner.scoop.attentionTarget) {
      owner.stop();
      owner.faceTarget(owner.scoop.attentionTarget);
      owner.playClip("idle_nervous");

      return;
    }
    const royal = owner.resolveRoyalTarget();
    const nearbyGoo = owner.findGluedDoor();
    owner.scratchTarget = nearbyGoo ?? (royal && owner.findClosedDoor(royal));
    // Keep advancing even during a local cleanup approach. Resuming a stale
    // ground waypoint after climbing the entrance traps the bug behind peers.
    const waypoint = owner.route.next();
    if (owner.canScratchDoor) {
      owner.transition(BellBugScratchState.name);

      return;
    }
    const destination = nearbyGoo ?? waypoint ?? royal;
    if (!destination) {
      owner.stop();
      owner.playClip("idle_nervous");

      return;
    }
    owner.playClip(owner.moveToward(destination, owner.walkSpeed) ? "scuttle_walk" : "idle_nervous");
    if (royal && owner.distanceTo(royal) < 0.7) {
      owner.stop();
      owner.faceTarget(royal);
      owner.playClip("scratch_attack");
    }
  }
}

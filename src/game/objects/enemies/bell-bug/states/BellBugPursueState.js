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
    if (owner.fleshScratch?.target) {
      owner.fleshScratch.approach();

      return;
    }
    const royal = owner.resolveRoyalTarget();
    const nearbyGoo = owner.findGluedDoor();
    // Keep advancing even during a local cleanup approach. Resuming a stale
    // ground waypoint after climbing the entrance traps the bug behind peers.
    const waypoint = owner.route.next();
    // The royal can be across a courtyard wall from the entrance. Check the
    // actual route first so that wall cannot hide the door blocking our feet.
    owner.scratchTarget = nearbyGoo ?? (waypoint && owner.findClosedDoor(waypoint)) ??
      (royal && owner.findClosedDoor(royal));
    if (owner.canScratchDoor) {
      owner.transition(BellBugScratchState.name);

      return;
    }
    // Line up in front of a closed leaf before trying the route through it.
    // Inside, keep the obstructing door ahead of an off-center royal target.
    const destination = owner.doorApproach.next(owner.scratchTarget) ?? nearbyGoo ?? waypoint ?? owner.scratchTarget ?? royal;
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

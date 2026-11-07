import { State } from "yuka";
import { BellBugScratchRecoverState } from "./BellBugScratchRecoverState.js";

/**
 * Scratch windup/contact/recovery. Opening the door cancels contact.
 */
export class BellBugScratchState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.doorScratch.reset();
    this.lastContact = -1;
    this.lastContactSound = -1;
    owner.stop();
    owner.faceTarget(owner.doorScratch.facingTarget);
    owner.playClip("door_scratch_start");
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    owner.stop();
    if (!owner.canScratchDoor) {
      owner.transition(BellBugScratchRecoverState.name);

      return;
    }
    const meal = owner.doorScratch.meal;
    if (meal?.active) {
      owner.faceTarget(owner.doorScratch.facingTarget);
      owner.playClip("door_scratch_start");

      return;
    }
    owner.phaseTime += owner.deltaTime;
    owner.doorScratch.prepare();
    if (owner.doorScratch.repositionTarget) {
      const goal = owner.doorScratch.repositionTarget;
      const moving = owner.moveToward(goal, owner.walkSpeed*0.4,0.035);
      const distance = Math.hypot(goal.position.x-owner.position.x,goal.position.z-owner.position.z);
      if (this.moveGoal!==goal || distance<this.moveDistance-0.01) {
        this.moveGoal = goal;
        this.moveDistance = distance;
        this.stalledTime = 0;
      } else {
        this.stalledTime += owner.deltaTime;
      }
      if (distance<=0.04) {
        owner.faceTarget(owner.doorScratch.facingTarget);
        owner.doorScratch.finishReposition();
        owner.phaseTime = 0;
        this.lastContact = -1;
        this.lastContactSound = -1;
      } else if (this.stalledTime>=1) {
        owner.doorScratch.finishReposition(true);
        owner.phaseTime = 0;
        this.lastContact = -1;
        this.lastContactSound = -1;
      }
      owner.playClip(moving ? "scuttle_walk" : "door_scratch_start");

      return;
    }
    if (owner.doorScratch.stroke && !owner.doorScratch.facingStroke) {
      owner.faceTarget(owner.doorScratch.facingTarget);
      owner.phaseTime -= owner.deltaTime;
      owner.playClip("door_scratch_start");

      return;
    }
    // Contacts can nudge the native body away from the leaf. Close that
    // gap between strokes rather than extending a claw beyond its real reach.
    if (owner.phaseTime >= 0.3 && !owner.doorScratch.stroke) {
      owner.moveToward(owner.scratchTarget, owner.walkSpeed * 0.35);
    }
    const soundContact = Math.floor((owner.phaseTime - 0.5) / 0.75);
    if (owner.phaseTime >= 0.5 && soundContact > this.lastContactSound) {
      owner.doorScratch.beginContact();
      this.lastContactSound = soundContact;
    }
    const contact = Math.floor((owner.phaseTime - 0.85) / 0.75);
    if (owner.phaseTime >= 0.85 && contact > this.lastContact) {
      owner.scratchDoor();
      this.lastContact = contact;
    }
    // Goo strokes already animate the contacting claw through the pose layer.
    // Hold the raised socket: the wood loop lowers it and invalidates the
    // reach used to choose the goo, causing endless retry/reposition cycles.
    owner.playClip(owner.phaseTime < 0.3 || !owner.doorScratch.stroke || owner.doorScratch.stroke.mass ? "door_scratch_start" : "door_scratch_loop");
  }
}

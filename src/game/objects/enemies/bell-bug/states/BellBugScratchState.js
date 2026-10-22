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
    this.lastContact = -1;
    owner.stop();
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
    owner.phaseTime += owner.deltaTime;
    const contact = Math.floor((owner.phaseTime - 0.85) / 0.75);
    if (owner.phaseTime >= 0.85 && contact > this.lastContact) {
      owner.scratchDoor();
      this.lastContact = contact;
    }
    owner.playClip(owner.phaseTime < 0.3 ? "door_scratch_start" : "door_scratch_loop");
  }
}

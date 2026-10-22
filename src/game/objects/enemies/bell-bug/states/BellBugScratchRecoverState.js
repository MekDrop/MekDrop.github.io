import { State } from "yuka";
import { BellBugPursueState } from "./BellBugPursueState.js";

/**
 * Let the released claws settle before resuming movement through an open door.
 */
export class BellBugScratchRecoverState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.stop();
    owner.phaseTime = 0;
    owner.playClip("door_scratch_end");
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.25) {
      owner.transition(BellBugPursueState.name);
    }
  }
}

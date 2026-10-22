import { State } from "yuka";
import { BellBugPursueState } from "./BellBugPursueState.js";

/**
 * Involuntary fear recoil, ringing contact, then cowering recovery.
 */
export class BellBugPanicState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("fear_recoil");
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    owner.stop();
    if (owner.phaseTime >= 0.45 && owner.fearEvent) {
      owner.ringInFear();
    }
    const time = owner.phaseTime;
    owner.playClip(time < 0.2 ? "fear_recoil" : time < 0.45 ? "panic_ring_start" :
      time < 1.2 ? "panic_ring_loop" : time < 1.5 ? "panic_ring_end" : "cower");
    if (time >= 1.8) {
      owner.transition(BellBugPursueState.name);
    }
  }
}

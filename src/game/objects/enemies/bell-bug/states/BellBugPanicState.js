import { State } from "yuka";
import { BellBugPursueState } from "./BellBugPursueState.js";
import { BELL_BUG_ANIMATION } from "../BellBugAnimation.js";
import { BellBugCalibration } from "../BellBugCalibration.js";

const HIDE_TRANSITION_SECONDS = 0.6;

/**
 * Stationary bell vibration; the visual root shakes without moving its collider.
 */
export class BellBugPanicState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip(BELL_BUG_ANIMATION.HIDE_START);
    owner.ringInFear();
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    owner.stop();
    const time = owner.phaseTime;
    owner.playClip(time < HIDE_TRANSITION_SECONDS ? BELL_BUG_ANIMATION.HIDE_START :
      time < owner.panicDuration - HIDE_TRANSITION_SECONDS ? BELL_BUG_ANIMATION.HIDE_LOOP :
        BELL_BUG_ANIMATION.HIDE_END);
    owner.animationPlayback?.model.setLocalPosition(Math.sin(time * 95) * 0.035 * BellBugCalibration.scale, BellBugCalibration.y, BellBugCalibration.z);
    if (time >= owner.panicDuration) {
      owner.transition(BellBugPursueState.name);
    }
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  exit(owner) {
    owner.animationPlayback?.model.setLocalPosition(0, BellBugCalibration.y, BellBugCalibration.z);
  }
}

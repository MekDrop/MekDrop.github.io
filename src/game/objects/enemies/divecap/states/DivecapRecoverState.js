import { State } from "yuka";

export class DivecapRecoverState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.phaseStarted = owner.elapsed;
    owner.playClip("recover", true);
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    owner.stop();
    if (owner.elapsed - owner.phaseStarted >= 0.5) {
      owner.changeState("DivecapPursueState");
    }
  }
}

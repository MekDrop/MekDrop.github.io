import { State } from "yuka";

export class DivecapCarriedState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("carried_ready", true);
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    if (!owner.carrier && !owner.airborne) {
      owner.changeState("DivecapPursueState");
    }
  }
}

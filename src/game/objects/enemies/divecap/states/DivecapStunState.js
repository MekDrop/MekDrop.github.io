import { State } from "yuka";

export class DivecapStunState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("stun", true);
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    owner.stop();
    if (!owner.statuses.has("stun") && !owner.statuses.has("confused")) {
      owner.changeState("DivecapRecoverState");
    }
  }
}

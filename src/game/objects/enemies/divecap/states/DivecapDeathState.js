import { State } from "yuka";

export class DivecapDeathState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.phaseStarted = owner.elapsed;
    owner.playClip("death", true);
    owner.stop();
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    if (owner.elapsed - owner.phaseStarted >= 1) {
      owner.destroy();
    }
  }
}

import { State } from "yuka";

export class DoorcrackerReactionState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stop();
    owner.stateTime = 0;
    owner.playClip(owner.reactionClip, true);
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    owner.stateTime += owner.deltaTime;
    if (owner.statuses.has("stun")) {
      owner.playClip("stun");
      owner.stateTime = 0;

      return;
    }
    if (owner.activeClip === "stun") {
      owner.stateTime = 0;
      owner.playClip("stun_recover", true);

      return;
    }
    if (owner.stateTime >= owner.clipDuration(owner.reactionClip)) {
      owner.changeState("DoorcrackerPursueState");
    }
  }
}

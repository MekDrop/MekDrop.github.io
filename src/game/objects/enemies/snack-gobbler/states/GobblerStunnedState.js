import { State } from "yuka";
import { GobblerPursueState } from "./GobblerPursueState.js";
import { GobblerAngryState } from "./GobblerAngryState.js";

export class GobblerStunnedState extends State {
  /**
   * @type {number}
   */
  #recovery = 0;

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  enter(owner) {
    this.#recovery = 0;
    owner.stop();
    owner.requestClip("stun");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    if (owner.statuses.has("stun")) {
      return;
    }
    owner.requestClip("stun_recover");
    this.#recovery += owner.deltaTime;
    if (this.#recovery >= 0.5) {
      owner.behavior.changeTo(owner.angryUntil > owner.elapsed ? GobblerAngryState.name : GobblerPursueState.name);
    }
  }
}

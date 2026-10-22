import { State } from "yuka";
import { GobblerPursueState } from "./GobblerPursueState.js";

export class GobblerHitState extends State {
  /**
   * @type {number}
   */
  #elapsed = 0;

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  enter(owner) {
    this.#elapsed = 0;
    owner.stop();
    owner.requestClip("hit");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    this.#elapsed += owner.deltaTime;
    if (this.#elapsed >= 0.3667) {
      owner.behavior.changeTo(GobblerPursueState.name);
    }
  }
}

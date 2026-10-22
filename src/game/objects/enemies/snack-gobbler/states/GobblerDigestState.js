import { State } from "yuka";
import { GobblerPursueState } from "./GobblerPursueState.js";

export class GobblerDigestState extends State {
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
    owner.requestClip("swallow");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    this.#elapsed += owner.deltaTime;
    if (this.#elapsed < 0.6) {
      owner.requestClip("swallow");
    } else if (this.#elapsed < 1.2) {
      owner.requestClip("chew");
    } else if (this.#elapsed < 1.7) {
      owner.requestClip("gulp");
    } else if (this.#elapsed < 3.7) {
      owner.requestClip("doze_loop");
    } else if (this.#elapsed < 4.3) {
      owner.requestClip("wake");
    } else {
      owner.behavior.changeTo(GobblerPursueState.name);
    }
  }
}

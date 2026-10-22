import { State } from "yuka";
import { GobblerPursueState } from "./GobblerPursueState.js";

export class GobblerAngryState extends State {
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
    owner.requestClip("land");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    this.#elapsed += owner.deltaTime;
    owner.requestClip(this.#elapsed < 0.4 ? "land" : this.#elapsed < 0.8 ? "land_recover" : "angry");
    if (this.#elapsed >= 1.5) {
      owner.behavior.changeTo(GobblerPursueState.name);
    }
  }
}

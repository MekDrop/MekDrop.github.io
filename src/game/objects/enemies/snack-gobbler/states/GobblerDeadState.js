import { State } from "yuka";

export class GobblerDeadState extends State {
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
    owner.requestClip("death");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    this.#elapsed += owner.deltaTime;
    if (this.#elapsed >= 1.5) {
      owner.destroy();
    }
  }
}

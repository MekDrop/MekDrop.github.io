import { State } from "yuka";
import { GobblerPursueState } from "./GobblerPursueState.js";
import { GobblerDigestState } from "./GobblerDigestState.js";

export class GobblerBiteState extends State {
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {boolean}
   */
  #contact = false;

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  enter(owner) {
    this.#elapsed = 0;
    this.#contact = false;
    owner.stop();
    owner.requestClip("bite_windup");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    this.#elapsed += owner.deltaTime;
    if (this.#elapsed >= 0.35 && this.#elapsed < 0.5167) {
      owner.requestClip("bite_strike");
    }
    if (!this.#contact && this.#elapsed >= 0.425) {
      this.#contact = true;
      if (owner.consume(owner.biteTarget)) {
        owner.behavior.changeTo(GobblerDigestState.name);

        return;
      }
      // Never turn a failed meal into friendly-fire damage.
      if (!owner.biteTarget?.isEnemy) {
        owner.bite(owner.biteTarget);
      }
    }
    if (this.#elapsed >= 0.5167) {
      owner.requestClip("bite_recover");
    }
    if (this.#elapsed >= 0.9667) {
      owner.behavior.changeTo(GobblerPursueState.name);
    }
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  exit(owner) {
    owner.biteTarget = null;
  }
}

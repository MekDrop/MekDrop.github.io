import { State } from "yuka";
import { HookClimbState } from "./HookClimbState.js";
import { HookDetachedState } from "./HookDetachedState.js";

export class HookClingLandingState extends State {
  /**
   * @type {import("../HookClimbBehavior.js").HookClimbBehavior}
   */
  #control;
  /**
   * @type {number}
   */
  #started = 0;
  /**
   * @param {import("../HookClimbBehavior.js").HookClimbBehavior} control
   */
  constructor(control) {
    super();

    this.#control = control;
  }
  enter() {
    this.#started = this.#control.enemy.elapsed;
    this.#control.play("successful_cling_land");
  }
  execute() {
    if (this.#control.interrupt()) {
      return;
    }
    if (!this.#control.grip.climb(0)) {
      this.#control.enemy.airborne = true;
      this.#control.change(HookDetachedState);
    } else if (this.#control.enemy.elapsed - this.#started >= 0.6) {
      this.#control.change(HookClimbState);
    }
  }
}

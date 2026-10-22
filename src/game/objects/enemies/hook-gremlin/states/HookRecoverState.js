import { State } from "yuka";
import { HookDetachedState } from "./HookDetachedState.js";

export class HookRecoverState extends State {
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
    this.#control.play("recover");
  }
  execute() {
    if (this.#control.interrupt()) {
      return;
    }
    this.#control.enemy.stop();
    if (this.#control.enemy.elapsed - this.#started >= 0.8) {
      this.#control.change(HookDetachedState);
    }
  }
}

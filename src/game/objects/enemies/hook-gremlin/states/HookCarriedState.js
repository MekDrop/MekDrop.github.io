import { State } from "yuka";
import { HookDetachedState } from "./HookDetachedState.js";

export class HookCarriedState extends State {
  /**
   * @type {import("../HookClimbBehavior.js").HookClimbBehavior}
   */
  #control;
  /**
   * @param {import("../HookClimbBehavior.js").HookClimbBehavior} control
   */
  constructor(control) {
    super();

    this.#control = control;
  }

  enter() {
    this.#control.grip.release();
    this.#control.play("carried_ready");
  }

  execute() {
    if (!this.#control.enemy.alive) {
      this.#control.interrupt();
    } else if (!this.#control.enemy.carrier) {
      this.#control.change(HookDetachedState);
    }
  }
}

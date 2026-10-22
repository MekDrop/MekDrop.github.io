import { State } from "yuka";

export class HookDeadState extends State {
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
    this.#control.enemy.stop();
    this.#control.play("death");
  }
}

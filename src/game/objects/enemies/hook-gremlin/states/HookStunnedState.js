import { State } from "yuka";
import { HookRecoverState } from "./HookRecoverState.js";

export class HookStunnedState extends State {
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
    if (this.#control.grip.attached) {
      this.#control.enemy.airborne = true;
    }
    this.#control.grip.release();
    this.#control.play(this.#control.enemy.statuses.get("stun")?.reason === "missed-land" ? "missed_land_stun" : "external_stun");
  }

  execute() {
    const control = this.#control;
    if (!control.enemy.alive || control.enemy.carrier) {
      control.interrupt();

      return;
    }
    control.enemy.stop();
    if (!control.enemy.statuses.has("stun")) {
      control.change(HookRecoverState);
    }
  }
}

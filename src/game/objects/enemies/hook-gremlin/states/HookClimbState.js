import { State } from "yuka";
import { HookDetachedState } from "./HookDetachedState.js";

export class HookClimbState extends State {
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
    this.#control.play("climb_start");
  }

  execute() {
    const control = this.#control;
    if (control.interrupt()) {
      return;
    }
    const royal = control.enemy.resolveRoyalTarget();
    if (control.tryAttack()) {
      return;
    }
    const target = control.enemy.targetPosition(royal);
    const ready = control.enemy.elapsed - this.#started >= 0.6;
    // A royal behind a wall may be on the same floor. Climb to an actual ledge,
    // rather than stopping at the person's elevation on the outside of the wall.
    const speed = ready && target ? 0.85 : 0;
    const inward = control.grip.inward;
    if (!control.grip.climb(speed)) {
      if (control.tryMantle(inward)) {
        return;
      }
      control.enemy.airborne = true;
      control.change(HookDetachedState);

      return;
    }
    if (ready) {
      control.play(speed ? "climb_loop" : "cling_idle");
    }
  }
}

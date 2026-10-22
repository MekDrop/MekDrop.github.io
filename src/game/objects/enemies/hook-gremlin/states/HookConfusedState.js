import { State } from "yuka";
import { HookClimbState } from "./HookClimbState.js";
import { HookDetachedState } from "./HookDetachedState.js";

export class HookConfusedState extends State {
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
    const control = this.#control;
    const wasAttached = control.grip.attached;
    const attached = wasAttached && control.grip.climb(0);
    if (wasAttached && !attached) {
      control.enemy.airborne = true;
    }
    control.play(attached ? "confused_cling" : "hit");
  }

  execute() {
    const control = this.#control;
    const enemy = control.enemy;
    if (!enemy.alive || enemy.carrier || enemy.statuses.has("stun")) {
      control.interrupt();

      return;
    }
    const wasAttached = control.grip.attached;
    const attached = wasAttached && control.grip.climb(0);
    if (wasAttached && !attached) {
      enemy.airborne = true;
    }
    if (!attached) {
      // Never stop airborne velocity: Ammo must continue a missed throw/fall.
      enemy.stop();
    }
    if (!enemy.statuses.has("confused")) {
      control.change(attached ? HookClimbState : HookDetachedState);
    }
  }
}

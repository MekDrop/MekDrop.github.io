import { State } from "yuka";
import { HookDetachedState } from "./HookDetachedState.js";
import { HookClimbState } from "./HookClimbState.js";

export class HookAttackState extends State {
  /**
   * @type {import("../HookClimbBehavior.js").HookClimbBehavior}
   */
  #control;
  /**
   * @type {number}
   */
  #started = 0;
  /**
   * @type {import("../../shared/Enemy.js").EnemyActor|null}
   */
  #target = null;
  /**
   * @type {boolean}
   */
  #contactFired = false;
  /**
   * @param {import("../HookClimbBehavior.js").HookClimbBehavior} control
   */
  constructor(control) {
    super();

    this.#control = control;
  }
  enter() {
    this.#started = this.#control.enemy.elapsed;
    this.#target = this.#control.enemy.resolveRoyalTarget();
    this.#contactFired = false;
    this.#control.enemy.stop();
    this.#control.play("hook_attack");
  }
  execute() {
    const control = this.#control;
    if (control.interrupt()) {
      return;
    }
    if (control.grip.attached) {
      control.grip.climb(0);
    }
    const age = control.enemy.elapsed - this.#started;
    if (age >= 0.4 && !this.#contactFired) {
      this.#contactFired = true;
      control.enemy.strikeRoyal?.(this.#target);
    }
    if (age >= 1) {
      control.change(control.grip.attached ? HookClimbState : HookDetachedState);
    }
  }
}

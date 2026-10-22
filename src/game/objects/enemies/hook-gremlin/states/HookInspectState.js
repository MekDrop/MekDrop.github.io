import { State } from "yuka";
import { Vec3 } from "playcanvas";
import { HookDetachedState } from "./HookDetachedState.js";

/**
 * Map-authored clip inspection pauses movement without replacing the Yuka machine.
 */
export class HookInspectState extends State {
  /**
   * @type {import("../HookClimbBehavior.js").HookClimbBehavior}
   */
  #control;
  /**
   * @type {Vec3|null}
   */
  #factor = null;
  /**
   * @param {import("../HookClimbBehavior.js").HookClimbBehavior} control
   */
  constructor(control) {
    super();

    this.#control = control;
  }
  enter() {
    const body = this.#control.enemy.entity.rigidbody;
    this.#factor = body?.linearFactor.clone() ?? null;
    if (body) {
      body.linearVelocity = new Vec3();
      body.linearFactor = new Vec3();
    }
  }
  execute() {
    const control = this.#control;
    if (control.interrupt()) {
      return;
    }
    if (control.grip.attached && !control.grip.validate()) {
      control.enemy.airborne = true;
      control.change(HookDetachedState);
    }
  }
  exit() {
    const body = this.#control.enemy.entity.rigidbody;
    if (body && this.#factor) {
      body.linearFactor = this.#control.grip.attached ? this.#factor : new Vec3(1, 1, 1);
    }
  }
}

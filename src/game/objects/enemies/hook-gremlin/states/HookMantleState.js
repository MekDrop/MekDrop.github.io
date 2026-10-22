import { State } from "yuka";
import { Vec3 } from "playcanvas";
import { HookDetachedState } from "./HookDetachedState.js";

export class HookMantleState extends State {
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
    this.#control.play("climb_top");
  }
  execute() {
    const control = this.#control;
    if (control.interrupt()) {
      return;
    }
    const ledge = control.ledge;
    const enemy = control.enemy;
    if (!ledge?.entity.enabled || enemy.elapsed - this.#started > 2.5) {
      enemy.airborne = true;
      control.change(HookDetachedState);

      return;
    }
    const body = enemy.entity.rigidbody;
    if (enemy.position.y < ledge.point.y + 0.06) {
      body.linearVelocity = new Vec3(0, 0.8, 0);
      body.applyForce(enemy.app.systems.rigidbody.gravity.clone().mulScalar(-body.mass));
    } else {
      control.play("mantle");
      body.linearVelocity = new Vec3(ledge.inward.x * 0.85, body.linearVelocity.y, ledge.inward.z * 0.85);
      enemy.airborne = true;
      if (enemy.position.clone().sub(ledge.start).dot(ledge.inward) > enemy.radius * 2 + 0.35) {
        control.change(HookDetachedState);
      }
    }
  }
}

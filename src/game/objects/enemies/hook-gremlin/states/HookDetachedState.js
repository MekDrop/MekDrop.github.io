import { State } from "yuka";

export class HookDetachedState extends State {
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

  execute() {
    const control = this.#control;
    if (control.interrupt()) {
      return;
    }
    const enemy = control.enemy;
    if (control.tryAttack()) {
      return;
    }
    const target = enemy.targetPosition(enemy.resolveRoyalTarget());
    if (!target) {
      enemy.stop();
      control.play(enemy.airborne ? "fall" : "idle");

      return;
    }
    const direction = target.clone().sub(enemy.position);
    const hit = control.grip.probe(direction);
    if (hit && control.catchSurface(hit)) {
      return;
    }
    if (enemy.airborne) {
      control.play("airborne_reach");

      return;
    }
    enemy.moveToward({ position: target }, 1.3);
    control.play("run");
  }
}

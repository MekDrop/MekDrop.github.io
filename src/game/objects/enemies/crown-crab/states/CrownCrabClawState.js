import { State } from "yuka";

export class CrownCrabClawState extends State {
  /**
   * @type {number}
   */
  #time = 0;
  /**
   * @type {boolean}
   */
  #contactApplied = false;

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    this.#time = 0;
    this.#contactApplied = false;
    crab.stop();
    crab.requestAnimation(crab.attackTarget?.enemyType === crab.enemyType ? "duel" : "claw_windup");
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    this.#time += crab.deltaTime;
    if (!this.#contactApplied && this.#time >= 0.45) {
      this.#contactApplied = true;
      const target = crab.attackTarget;
      if (target?.exteriorEntrance && crab.distanceTo(target) <= 1.8) {
        crab.requestAnimation("door_claw");
        target.openTemporarily(2);
      } else {
        crab.requestAnimation("claw_snap");
        crab.applyClawContact(target);
      }
      if (target?.enemyType === crab.enemyType) {
        crab.duelCooldownUntil = crab.elapsed + 4;
        target.duelCooldownUntil = target.elapsed + 4;
      }
    }
    if (this.#time >= 0.65) {
      crab.requestAnimation("claw_recover");
    }
    if (this.#time >= 1.1) {
      crab.resumePursuit();
    }
  }
}

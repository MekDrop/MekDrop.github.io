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
    crab.requestAnimation(typeof crab.attackTarget?.openTemporarily === "function" ? "door_claw" :
      crab.attackTarget?.enemyType === crab.enemyType ? "duel" : "claw_windup", true);
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    if (crab.suppressesRivalContact(crab.attackTarget)) {
      crab.resumePursuit();

      return;
    }
    this.#time += crab.deltaTime;
    const special = typeof crab.attackTarget?.openTemporarily === "function" || crab.attackTarget?.enemyType === crab.enemyType;
    if (!special && this.#time >= 0.45 && this.#time < 0.65) {
      crab.requestAnimation("claw_snap");
    }
    if (!this.#contactApplied && this.#time >= 0.6) {
      this.#contactApplied = true;
      const target = crab.attackTarget;
      if (typeof target?.openTemporarily === "function" && crab.distanceTo(target) <= 1.8 && crab.hasClearContact(target)) {
        target.testOpenAmount = null;
        // Include claw recovery and the slow body's passage through the swing.
        target.openTemporarily(4);
      } else {
        crab.applyClawContact(target);
      }
      if (target?.enemyType === crab.enemyType) {
        crab.duelCooldownUntil = crab.elapsed + 4;
        target.duelCooldownUntil = target.elapsed + 4;
      }
    }
    if (!special && this.#time >= 0.65) {
      crab.requestAnimation("claw_recover");
    }
    if (this.#time >= 1.1) {
      crab.resumePursuit();
    }
  }
}

import { State } from "yuka";

export class CrownCrabKnockbackState extends State {
  /**
   * @type {number}
   */
  #time = 0;

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    this.#time = 0;
    crab.requestAnimation("knockback", true);
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    this.#time += crab.deltaTime;
    // Ammo retains the imparted velocity during the recoil animation.
    if (this.#time >= 0.45) {
      crab.resumePursuit();
    }
  }
}

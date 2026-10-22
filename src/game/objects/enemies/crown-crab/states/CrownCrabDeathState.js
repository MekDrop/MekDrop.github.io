import { State } from "yuka";

export class CrownCrabDeathState extends State {
  /**
   * @type {number}
   */
  #time = 0;

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    this.#time = 0;
    crab.stop();
    crab.requestAnimation("death");
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    this.#time += crab.deltaTime;
    if (this.#time >= 1.5) {
      crab.destroy();
    }
  }
}

import { State } from "yuka";

export class CrownCrabHitState extends State {
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
    crab.requestAnimation(crab.hitAnimation, true);
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    this.#time += crab.deltaTime;
    if (this.#time >= 0.3) {
      crab.resumePursuit();
    }
  }
}

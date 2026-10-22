import { State } from "yuka";

export class CrownCrabLandingState extends State {
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
    crab.requestAnimation("land");
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    this.#time += crab.deltaTime;
    if (this.#time >= 0.2) {
      crab.requestAnimation("land_recover");
    }
    if (this.#time >= 0.6) {
      crab.resumePursuit();
    }
  }
}

import { State } from "yuka";

export class CrownCrabCarriedState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    crab.requestAnimation("pickup_struggle");
  }
}

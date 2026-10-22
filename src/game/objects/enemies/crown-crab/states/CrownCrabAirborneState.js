import { State } from "yuka";

export class CrownCrabAirborneState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    crab.requestAnimation("airborne_tumble");
  }
}

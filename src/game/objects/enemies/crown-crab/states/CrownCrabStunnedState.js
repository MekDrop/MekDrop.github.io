import { State } from "yuka";

export class CrownCrabStunnedState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    crab.stop();
    crab.requestAnimation("stun");
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    if (!crab.statuses.has("stun")) {
      crab.resumePursuit();
    }
  }
}

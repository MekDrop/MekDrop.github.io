import { State } from "yuka";

export class CrownCrabAngryState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    crab.stop();
    crab.requestAnimation("angry_warn");
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    if (crab.grudgesSuppressed || crab.elapsed >= crab.warningUntil) {
      crab.resumePursuit();
    }
  }
}

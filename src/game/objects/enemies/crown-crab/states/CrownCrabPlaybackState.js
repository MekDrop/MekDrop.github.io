import { State } from "yuka";

/**
 * Saved-map clip inspection suspends behavior without replacing the Yuka machine.
 */
export class CrownCrabPlaybackState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    crab.stop();
    crab.requestAnimation(crab.testAnimation, true);
  }
}

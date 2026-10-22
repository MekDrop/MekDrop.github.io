import { State } from "yuka";

/**
 * Saved-map clip inspection pauses decisions without replacing the Yuka machine.
 */
export class FrostPuffClipTestState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    owner.stop();
  }
}

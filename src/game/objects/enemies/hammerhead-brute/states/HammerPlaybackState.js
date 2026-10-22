import { State } from "yuka";

/**
 * Map HUD inspection suspends behavior through the same Yuka machine.
 */
export class HammerPlaybackState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.stop();
  }
}

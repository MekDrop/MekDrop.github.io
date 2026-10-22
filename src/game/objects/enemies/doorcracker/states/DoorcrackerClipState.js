import { State } from "yuka";

/**
 * Saved test-map playback uses the production hierarchy with AI suspended.
 */
export class DoorcrackerClipState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.testAnimation, true);
  }
}

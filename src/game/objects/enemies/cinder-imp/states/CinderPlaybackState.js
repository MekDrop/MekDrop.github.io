import { State } from "yuka";

/**
 * Test-map clip inspection pauses decisions through the same Yuka machine.
 */
export class CinderPlaybackState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.previewClip);
  }
}

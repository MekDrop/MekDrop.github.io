import { State } from "yuka";

/**
 * Explicit map inspection mode, owned by Yuka like normal behavior.
 */
export class BellBugPlaybackState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.previewClip);
  }
}

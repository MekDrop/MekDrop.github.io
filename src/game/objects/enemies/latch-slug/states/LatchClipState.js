import { State } from "yuka";

/**
 * Saved-map clip inspection deliberately suspends autonomous tasks.
 */
export class LatchClipState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    owner.stop();
  }
}

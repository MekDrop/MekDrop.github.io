import { State } from "yuka";

/**
 * Explicit test-only suspension of gameplay while embedded clips are inspected.
 */
export class WreckerPlaybackState extends State {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  execute(owner) {
    owner.stop();
  }
}

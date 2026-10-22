import { State } from "yuka";

/**
 * Saved test-map clip controls suspend pursuit without replacing the model.
 */
export class BruteClipTestState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.testClip, true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
  }
}

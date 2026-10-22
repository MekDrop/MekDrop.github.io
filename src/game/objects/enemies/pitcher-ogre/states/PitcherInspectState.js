import { State } from "yuka";

/**
 * Saved-map inspection only; physical collisions and engine clips stay active.
 */
export class PitcherInspectState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
  }
}

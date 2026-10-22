import { State } from "yuka";

/**
 * A reached royal is one encounter, rather than a new game-over every frame.
 */
export class PitcherRoyalReachedState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
    ogre.requestAnimation("idle");
    ogre.targetRoyal?.beginGameOver?.(ogre.cameraPosition.bind(ogre));
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.targetRoyal?.alive === false || ogre.distanceTo(ogre.targetRoyal) > 2) {
      ogre.changeState("PitcherPursueState");
    }
  }
}

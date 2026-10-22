import { State } from "yuka";

export class PitcherRejectState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
    ogre.stateStartedAt = ogre.elapsed;
    ogre.requestAnimation("reject_heavy");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.elapsed - ogre.stateStartedAt >= 0.9) {
      ogre.changeState(ogre.hasPassenger ? "PitcherAimState" : "PitcherPursueState");
    }
  }
}

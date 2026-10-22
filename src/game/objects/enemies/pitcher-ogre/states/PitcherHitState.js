import { State } from "yuka";

export class PitcherHitState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
    ogre.stateStartedAt = ogre.elapsed;
    ogre.requestAnimation("hit");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.elapsed - ogre.stateStartedAt >= 0.4) {
      ogre.changeState(ogre.hasPassenger ? "PitcherAimState" : "PitcherPursueState");
    }
  }
}

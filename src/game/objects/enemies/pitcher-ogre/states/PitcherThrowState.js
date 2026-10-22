import { State } from "yuka";

export class PitcherThrowState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stateStartedAt = ogre.elapsed;
    ogre.stop();
    ogre.requestAnimation("throw_windup");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.elapsed - ogre.stateStartedAt < 0.7) {
      return;
    }
    ogre.changeState("PitcherReleaseState");
  }
}

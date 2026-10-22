import { State } from "yuka";

export class PitcherDeathState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.dropPassenger();
    ogre.candidate = null;
    ogre.stop();
    ogre.requestAnimation("death");
    ogre.stateStartedAt = ogre.elapsed;
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.elapsed - ogre.stateStartedAt > 2.5) {
      ogre.destroy();
    }
  }
}

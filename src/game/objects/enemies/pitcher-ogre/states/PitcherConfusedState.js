import { State } from "yuka";

export class PitcherConfusedState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
    ogre.dropPassenger();
    ogre.candidate = null;
    ogre.requestAnimation("confused_drop");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (!ogre.statuses.has("confused")) {
      ogre.changeState("PitcherPursueState");
    }
  }
}

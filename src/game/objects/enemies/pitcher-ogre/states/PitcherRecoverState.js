import { State } from "yuka";

export class PitcherRecoverState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stateStartedAt = ogre.elapsed;
    ogre.stop();
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    const time = ogre.elapsed - ogre.stateStartedAt;
    if (time >= 0.1) {
      ogre.requestAnimation("throw_recover");
    }
    if (time >= 0.8) {
      ogre.changeState("PitcherPursueState");
    }
  }
}

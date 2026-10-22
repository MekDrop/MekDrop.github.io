import { State } from "yuka";

export class PitcherAngryState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
    ogre.dropPassenger();
    ogre.stateStartedAt = ogre.elapsed;
    ogre.requestAnimation("angry_warn");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    const time = ogre.elapsed - ogre.stateStartedAt;
    if (time >= 0.9 && ogre.requestedAnimation !== "ground_punch") {
      ogre.requestAnimation("ground_punch");
    }
    if (time >= 2) {
      ogre.changeState("PitcherPursueState");
    }
  }
}

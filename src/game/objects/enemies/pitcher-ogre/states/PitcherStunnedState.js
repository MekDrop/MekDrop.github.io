import { State } from "yuka";

export class PitcherStunnedState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stop();
    ogre.dropPassenger();
    ogre.requestAnimation("stun");
    ogre.stateStartedAt = Infinity;
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.statuses.has("stun")) {
      return;
    }
    if (ogre.stateStartedAt === Infinity) {
      ogre.stateStartedAt = ogre.elapsed;
      ogre.requestAnimation("recover");
    }
    if (ogre.elapsed - ogre.stateStartedAt >= 0.6) {
      ogre.changeState("PitcherPursueState");
    }
  }
}

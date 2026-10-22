import { State } from "yuka";

export class PitcherPursueState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.candidate = null;
    ogre.requestAnimation("walk");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    const royal = ogre.resolveRoyalTarget();
    if (!royal) {
      ogre.stop();
      ogre.requestAnimation("idle");

      return;
    }
    ogre.candidate = ogre.findPassenger();
    if (ogre.candidate) {
      ogre.changeState("PitcherRecruitState");

      return;
    }
    if (ogre.distanceTo(royal) < 1.5) {
      ogre.targetRoyal = royal;
      ogre.changeState("PitcherRoyalReachedState");

      return;
    }
    ogre.moveToward(royal, 0.85);
  }
}

import { State } from "yuka";

export class PitcherRecruitState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stateStartedAt = ogre.elapsed;
    ogre.stop();
    ogre.requestAnimation("beckon_volunteer");
    ogre.candidate?.onCarryOffered?.(ogre);
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (!ogre.canPickUp(ogre.candidate) || ogre.elapsed - ogre.stateStartedAt > 5) {
      ogre.changeState("PitcherPursueState");

      return;
    }
    if (ogre.elapsed - ogre.stateStartedAt < 0.65) {
      return;
    }
    if (ogre.distanceTo(ogre.candidate) > 1.6) {
      ogre.requestAnimation("walk");
      ogre.moveToward(ogre.candidate, 0.85);

      return;
    }
    ogre.changeState("PitcherPickupState");
  }
}

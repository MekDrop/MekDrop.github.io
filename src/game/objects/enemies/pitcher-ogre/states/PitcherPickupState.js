import { State } from "yuka";

export class PitcherPickupState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stateStartedAt = ogre.elapsed;
    ogre.stop();
    ogre.requestAnimation(ogre.isWillingPassenger(ogre.candidate) ? "pickup_willing" : "pickup_unwilling");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.elapsed - ogre.stateStartedAt < 0.55) {
      return;
    }
    if (!ogre.pickUp(ogre.candidate)) {
      ogre.changeState("PitcherPursueState");

      return;
    }
    ogre.changeState("PitcherAimState");
  }
}

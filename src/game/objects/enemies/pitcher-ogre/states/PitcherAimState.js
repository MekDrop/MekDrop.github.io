import { State } from "yuka";

export class PitcherAimState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stateStartedAt = ogre.elapsed;
    ogre.nextPlanAt = ogre.elapsed;
    ogre.stop();
    ogre.requestAnimation("aim");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (!ogre.hasPassenger) {
      ogre.changeState("PitcherPursueState");

      return;
    }
    const royal = ogre.resolveRoyalTarget();
    if (!royal || ogre.elapsed - ogre.stateStartedAt > 5) {
      ogre.dropPassenger();
      ogre.changeState("PitcherRecoverState");

      return;
    }
    if (ogre.elapsed < ogre.nextPlanAt) {
      return;
    }
    ogre.nextPlanAt = ogre.elapsed + 0.25;
    ogre.aimSolution = ogre.throwPlanner.plan(ogre.passenger, ogre.targetPosition(royal));
    if (ogre.aimSolution && ogre.elapsed - ogre.stateStartedAt >= 0.6) {
      ogre.stop();
      ogre.changeState("PitcherThrowState");

      return;
    }
    ogre.requestAnimation("hold_walk");
    ogre.moveToward(royal, 0.55);
  }
}

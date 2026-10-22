import { State } from "yuka";

/**
 * Release contact occurs midway through the separately authored release clip.
 */
export class PitcherReleaseState extends State {
  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  enter(ogre) {
    ogre.stateStartedAt = ogre.elapsed;
    ogre.stop();
    ogre.requestAnimation("throw_release");
  }

  /**
   * @param {import("../PitcherOgre.js").PitcherOgre} ogre
   */
  execute(ogre) {
    if (ogre.elapsed - ogre.stateStartedAt < 0.1) {
      return;
    }
    // Recheck at actual hand contact; obstacles can move during anticipation.
    const royal = ogre.resolveRoyalTarget();
    const solution = royal && ogre.hasPassenger
      ? ogre.throwPlanner.plan(ogre.passenger, ogre.targetPosition(royal)) : null;
    if (!solution || !ogre.releasePassenger(solution.velocity)) {
      ogre.changeState("PitcherAimState");

      return;
    }
    ogre.changeState("PitcherRecoverState");
  }
}

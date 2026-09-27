import { State } from "yuka";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";
import { ROYAL_GAME_OVER_PHASE } from "../../enum/RoyalGameOverPhase.js";

export class RoyalWalkOutState extends State {
  get phase() {
    return ROYAL_GAME_OVER_PHASE.WALK_OUT;
  }

  enter(owner) {
    owner.elapsed = 0;
    owner.beginWalk();
    owner.playAnimation(ROYAL_ANIMATION.WALK_OUT);
  }

  execute(owner) {
    owner.elapsed += owner.deltaTime;
    const travelProgress = Math.max(
      0,
      Math.min(
        1,
        (owner.elapsed - owner.walkStartDelay) /
          (owner.walkDuration - owner.walkStartDelay),
      ),
    );
    const easedProgress =
      travelProgress * travelProgress * (3 - 2 * travelProgress);
    const pathClear = owner.move(easedProgress);
    if (!pathClear || travelProgress === 1) {
      owner.completeWalk();
    }
  }
}

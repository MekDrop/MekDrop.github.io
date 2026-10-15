import { State } from "yuka";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";
import { ROYAL_GAME_OVER_PHASE } from "../../enum/RoyalGameOverPhase.js";

export class RoyalWalkOutState extends State {
  /**
   *
    * @returns {string|number}
   */
  get phase() {
    return ROYAL_GAME_OVER_PHASE.WALK_OUT;
  }

  /**
   *
   * @param {{isResumingReaction?: () => boolean, elapsed: number, deltaTime: number, walkDuration: number, walkStartDelay: number, beginWalk: () => void, move: (progress: number) => boolean|null, playAnimation: (animation: string) => void, completeWalk: () => void}} owner
   */
  enter(owner) {
    if (owner.isResumingReaction?.()) { return; }
    owner.elapsed = 0;
    owner.beginWalk();
    owner.playAnimation(ROYAL_ANIMATION.WALK_OUT);
  }

  /**
   *
   * @param {{isResumingReaction?: () => boolean, elapsed: number, deltaTime: number, walkDuration: number, walkStartDelay: number, beginWalk: () => void, move: (progress: number) => boolean|null, playAnimation: (animation: string) => void, completeWalk: () => void}} owner
   */
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
    if (pathClear === null) {
      owner.elapsed -= owner.deltaTime;

      return;
    }
    if (!pathClear || travelProgress === 1) {
      owner.completeWalk();
    }
  }
}

import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTimedActionState } from "./HeroTimedActionState.js";

export class HeroBlockedDigReactionActionState extends HeroTimedActionState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super(HERO_ACTION.BLOCKED_DIG_REACTION, duration, {
      animation: HERO_ANIMATION.DIG_BLOCKED_ANNOYED,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      requiresGrounded: true,
      blocksMovement: true,
      allowsIdleHeadLook: false,
      locksHeadForward: true,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    owner.feedback.blockedDig.begin();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  reenter(owner) {
    owner.feedback.blockedDig.begin();
  }
}

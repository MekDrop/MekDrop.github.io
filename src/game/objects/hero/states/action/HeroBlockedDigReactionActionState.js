import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTimedActionState } from "./HeroTimedActionState.js";

export class HeroBlockedDigReactionActionState extends HeroTimedActionState {
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

  enter(owner) {
    super.enter(owner);
    owner.feedback.blockedDig.begin();
  }

  reenter(owner) {
    owner.feedback.blockedDig.begin();
  }
}

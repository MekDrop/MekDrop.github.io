import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { FOOT_SIDE } from "../../../../enum/FootSide.js";
import { HeroTimedActionState } from "./HeroTimedActionState.js";

export class HeroEdgeRefusalActionState extends HeroTimedActionState {
  constructor(duration) {
    super(HERO_ACTION.EDGE_REFUSAL, duration, {
      animation: ({ payload }) => payload.foot === FOOT_SIDE.RIGHT
        ? HERO_ANIMATION.EDGE_REFUSE_RIGHT
        : HERO_ANIMATION.EDGE_REFUSE_LEFT,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      allowsJump: true,
      blocksMovement: true,
      facing: ({ payload }) => payload.direction,
    });
  }

  enter(owner) {
    super.enter(owner);
    owner.feedback.refusal.beginEdge(this.payload);
  }
}

export class HeroHoleRefusalActionState extends HeroTimedActionState {
  constructor(duration) {
    super(HERO_ACTION.HOLE_REFUSAL, duration, {
      animation: HERO_ANIMATION.HOLE_REFUSAL,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      blocksMovement: true,
      facing: ({ payload }) => payload.direction,
      allowsIdleHeadLook: false,
      locksHeadForward: true,
    });
  }

  enter(owner) {
    super.enter(owner);
    owner.feedback.refusal.beginHole(this.payload);
  }
}

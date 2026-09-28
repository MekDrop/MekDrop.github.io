import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { FOOT_SIDE } from "../../../../enum/FootSide.js";
import { HeroTimedActionState } from "./HeroTimedActionState.js";

export class HeroEdgeRefusalActionState extends HeroTimedActionState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super(HERO_ACTION.EDGE_REFUSAL, duration, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: ({ payload }) => payload.foot === FOOT_SIDE.RIGHT
        ? HERO_ANIMATION.EDGE_REFUSE_RIGHT
        : HERO_ANIMATION.EDGE_REFUSE_LEFT,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      allowsJump: true,
      blocksMovement: true,
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      facing: ({ payload }) => payload.direction,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    owner.feedback.refusal.beginEdge(this.payload);
  }
}

export class HeroHoleRefusalActionState extends HeroTimedActionState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super(HERO_ACTION.HOLE_REFUSAL, duration, {
      animation: HERO_ANIMATION.HOLE_REFUSAL,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      blocksMovement: true,
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      facing: ({ payload }) => payload.direction,
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
    owner.feedback.refusal.beginHole(this.payload);
  }
}

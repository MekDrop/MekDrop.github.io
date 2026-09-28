import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTimedActionState } from "./HeroTimedActionState.js";

export class HeroRepelledActionState extends HeroTimedActionState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super(HERO_ACTION.REPELLED, duration, {
      animation: HERO_ANIMATION.REPELLED,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      /**
       *
       * @param {{owner: import("src/game/objects/ObjectTypes.js").HeroActionContext, payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} options.owner
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      movement: ({ owner, payload }) => ({
        x: payload.x * owner.repelSpeed,
        z: payload.z * owner.repelSpeed,
      }),
      locksFacing: true,
      allowsIdleHeadLook: false,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    owner.feedback.repel.begin(this.payload);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    owner.feedback.repel.end();
    super.exit(owner);
  }
}

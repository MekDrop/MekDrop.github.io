import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTimedActionState } from "./HeroTimedActionState.js";

export class HeroRepelledActionState extends HeroTimedActionState {
  constructor(duration) {
    super(HERO_ACTION.REPELLED, duration, {
      animation: HERO_ANIMATION.REPELLED,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      movement: ({ owner, payload }) => ({
        x: payload.x * owner.repelSpeed,
        z: payload.z * owner.repelSpeed,
      }),
      locksFacing: true,
      allowsIdleHeadLook: false,
    });
  }

  enter(owner) {
    super.enter(owner);
    owner.feedback.repel.begin(this.payload);
  }

  exit(owner) {
    owner.feedback.repel.end();
    super.exit(owner);
  }
}

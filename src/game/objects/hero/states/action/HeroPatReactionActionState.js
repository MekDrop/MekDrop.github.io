import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroPatReactionActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.PAT_REACTION, {
      animation: HERO_ANIMATION.PAT_ANNOYED,
      canBePatted: true,
    });
  }

  execute(owner) {
    if (!owner.feedback.patReaction.shouldContinue()) {
      owner.finish();
      return;
    }
    this.payload.remaining = Math.max(
      0,
      this.payload.remaining - owner.deltaTime,
    );
    if (this.payload.remaining === 0) {
      owner.finish();
    }
  }
}
